'use strict';

function pad2(n) { return String(n).padStart(2, '0'); }

function zonedNow(tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = {};
  fmt.formatToParts(new Date()).forEach(({ type, value }) => { if (type !== 'literal') p[type] = value; });
  return p;
}

function buildReminderWindow() {
  const tz          = process.env.CLINIC_TIME_ZONE || 'America/Sao_Paulo';
  const hours       = Number(process.env.HOURS_BEFORE) || 12;
  const tolerance   = Number(process.env.REMINDER_TOLERANCE_MINUTES) || 30;
  const target      = new Date(Date.now() + hours * 3600000);
  const p           = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(target).filter(x => x.type !== 'literal').map(x => [x.type, x.value])
  );
  const totalMin = Number(p.hour) * 60 + Number(p.minute);
  const from = Math.max(0, totalMin - tolerance);
  const to   = Math.min(1439, totalMin + tolerance);
  return {
    targetDate: p.year + '-' + p.month + '-' + p.day,
    fromTime:   pad2(Math.floor(from / 60)) + ':' + pad2(from % 60),
    toTime:     pad2(Math.floor(to   / 60)) + ':' + pad2(to   % 60),
  };
}

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return '';
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return '';
}

function normalizeJid(raw) {
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const p = normalizePhone(raw);
  return p ? p + '@s.whatsapp.net' : '';
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

module.exports = { buildReminderWindow, normalizePhone, normalizeJid, formatDate };
