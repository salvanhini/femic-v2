'use strict';
const path = require('path');
const fs   = require('fs/promises');
const { Browsers, DisconnectReason, fetchLatestBaileysVersion, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino   = require('pino');
const qrcode = require('qrcode-terminal');
const { tag } = require('./log');
const { updateStatus } = require('./supabase');

const SVC_NAME  = process.env.WHATSAPP_SERVICE_NAME || 'baileys-main';
const AUTH_DIR  = path.join(__dirname, 'auth-' + SVC_NAME);
const LOGIN     = (process.env.WHATSAPP_LOGIN_METHOD || 'qr').trim();
const PAIR_PHONE = (process.env.WHATSAPP_PAIRING_PHONE || '').replace(/\D/g, '');
const RESET     = process.env.RESET_SESSION === 'true';

let sock       = null;
let sockGen    = 0;
let connected  = false;
let everConn   = false;
let reconnTimer= null;
let resetBusy  = false;
let starting   = false;

function closeSock() { if (sock) { try { sock.end(); } catch (_) {} sock = null; sockGen++; } }

function scheduleReconnect(ms, fn) {
  if (reconnTimer) return;
  reconnTimer = setTimeout(() => { reconnTimer = null; (fn || startBot)().catch(e => { tag('Reconn', e.message); scheduleReconnect(20000); }); }, ms);
}

async function resetSession(reason) {
  if (resetBusy) return;
  resetBusy = true;
  tag('Auth', 'Resetando sessao. Motivo:', reason);
  closeSock();
  await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(e => tag('Auth', 'Erro ao deletar auth:', e.message));
  resetBusy = false;
  scheduleReconnect(5000);
}

function jidToPhone(jid) { return (jid || '').replace(/\D/g, ''); }

async function startBot() {
  if (starting) return;
  starting = true;
  try {
    if (RESET) {
      closeSock();
      await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
      tag('Auth', 'RESET_SESSION ativo. Remova a variavel apos conectar.');
    }
    connected = false;
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    tag('Bot', 'WhatsApp Web v' + version.join('.') + (isLatest ? ' (latest)' : ''));
    closeSock();

    sock = makeWASocket({
      auth: state, version, printQRInTerminal: false,
      logger: pino({ level: 'silent' }), browser: Browsers.macOS('Desktop'),
      markOnlineOnConnect: true, syncFullHistory: false,
      connectTimeoutMs: 60000, retryRequestDelayMs: 2000,
    });

    if (!state.creds.registered && LOGIN === 'pairing' && PAIR_PHONE) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PAIR_PHONE);
          console.log('\n=== CODIGO DE PAREAMENTO ===\nNumero: +' + PAIR_PHONE + '\nCodigo: ' + code + '\n');
        } catch (e) { tag('Pair', e.message); }
      }, 3000);
    }

    const curGen = sockGen;

    sock.ev.on('connection.update', async (u) => {
      if (curGen !== sockGen) return;
      if (u.qr) {
        console.log('\n=== QR CODE — escaneie no WhatsApp ===\n');
        qrcode.generate(u.qr, { small: true });
        console.log('');
      }
      if (u.connection === 'open') {
        connected = true; everConn = true;
        if (reconnTimer) { clearTimeout(reconnTimer); reconnTimer = null; }
        tag('Bot', 'Conectado!');
        updateStatus(SVC_NAME, 'connected');
      }
      if (u.connection === 'close') {
        connected = false;
        const code   = u.lastDisconnect?.error?.output?.statusCode;
        const reason = u.lastDisconnect?.error?.message || 'desconhecido';
        tag('Bot', 'Desconectado. Codigo:', code || '?', '| Motivo:', reason);
        if (code === 515 || code === 405) {
          await resetSession('bad session ' + code + ': ' + reason);
          updateStatus(SVC_NAME, 'reconnecting', reason);
          return;
        }
        if (code === DisconnectReason.loggedOut) {
          updateStatus(SVC_NAME, 'logged_out', reason);
          await resetSession(reason);
        } else {
          updateStatus(SVC_NAME, 'reconnecting', reason);
          scheduleReconnect(10000);
        }
      }
    });

    sock.ev.on('creds.update', (creds) => { if (curGen === sockGen) saveCreds(creds); });
    sock.ev.on('messages.upsert', ({ messages }) => {
      if (curGen !== sockGen || !messages) return;
      for (const m of messages) handleMessage(sock, m).catch(e => tag('Msg', e.message));
    });

  } finally { starting = false; }
}

async function handleMessage(activeSock, msg) {
  if (msg.key.fromMe) return;
  if (msg.key.remoteJid?.endsWith('@g.us')) return;
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '').trim();
  if (!text) return;
  const jid   = msg.key.remoteJid;
  const phone = jidToPhone(jid);
  tag('Msg', phone.slice(0,6) + '***:', text.slice(0,80));

  const { detectIntent }   = require('./intent');
  const { generateReply }  = require('./reply');
  const { bookingFlow }    = require('./booking');
  const { storeInbox, getHistory } = require('./supabase');

  try { await activeSock.sendPresenceUpdate('composing', jid); } catch (_) {}

  try {
    const intent = await detectIntent(text);
    storeInbox(phone, text, intent).catch(() => {});
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));

    if (intent.category === 'agendamento' && intent.confidence >= 0.65) {
      await bookingFlow(activeSock, jid, phone, text);
    } else {
      const history = await getHistory(phone, 4);
      const reply   = await generateReply(intent.category, text, history);
      if (reply) await activeSock.sendMessage(jid, { text: reply });
    }
  } catch (e) { tag('Msg', 'Erro:', e.message); }
  finally { try { await activeSock.sendPresenceUpdate('paused', jid); } catch (_) {} }
}

module.exports = { startBot, closeSock, getSock: () => sock, isConnected: () => connected, jidToPhone };
