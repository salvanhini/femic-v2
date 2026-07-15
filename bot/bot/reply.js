'use strict';
const GROQ_API   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const URL_AGE    = process.env.CAPTACAO_URL || 'https://salvanhini.github.io/agendar/';

const SYSTEM = `Voce e a secretaria virtual da FEMIC Fisioterapia Especializada (Araraquara-SP). Responde pelo WhatsApp da clinica de forma natural, acolhedora e profissional.

REGRAS:
- Maximo 3 frases curtas. Sem markdown. Sem asteriscos.
- No maximo 1 emoji por mensagem.
- Nunca invente precos, horarios ou nomes de profissionais.
- Se nao souber, diga que a equipe vai responder em breve.

CLINICA:
- Especialidades: fisioterapia, quiropraxia, dor cronica, coluna, joelho.
- Convenios: Unimed, Hapvida, Amil, Bradesco Saude, SulAmerica e particular.
- Agendamento online: ${URL_AGE}
- Para remarcar/cancelar: paciente informa novo dia/horario, equipe confirma.

POR CATEGORIA:
agendamento → passe o link e seja calorosa.
remarcar    → peca o novo dia/horario desejado.
duvida      → responda se souber; senao encaminhe para a equipe.
tarefa      → confirme que a equipe vai retornar em breve.
geral       → cumprimente e pergunte como pode ajudar.`;

const FALLBACK = {
  agendamento: `Ola! Que bom ter seu contato Para agendar sua avaliacao, acesse: ${URL_AGE} — e rapido! Qualquer duvida estamos aqui.`,
  remarcar:    'Ola! Para remarcar ou cancelar, por favor informe o dia e horario que prefere e nossa equipe confirma em breve. 📅',
  duvida:      'Ola! Recebemos sua duvida. Nossa equipe vai responder em breve.',
  tarefa:      'Ola! Recebemos sua mensagem e nossa equipe vai analisar e retornar em breve. ⏳',
  geral:       'Ola! Bem-vindo(a) a FEMIC Fisioterapia. Como posso ajudar?',
};

async function generateReply(category, text, history = []) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return FALLBACK[category] || FALLBACK.geral;

  const hist = history.slice().reverse().slice(0, 4).map((h, i) => `[${i+1}] ${h.message_text}`).join('\n');
  const user = (hist ? 'HISTORICO:\n' + hist + '\n' : '') + 'MENSAGEM: "' + text + '"\nCATEGORIA: ' + category + '\n\nResponda como secretaria da FEMIC:';

  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(GROQ_API, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.65, max_tokens: 220 }),
    });
    clearTimeout(t);
    if (!r.ok) return FALLBACK[category] || FALLBACK.geral;
    const d     = await r.json();
    const reply = d.choices?.[0]?.message?.content?.trim();
    console.log('[Reply]', reply?.slice(0, 80));
    return reply || FALLBACK[category] || FALLBACK.geral;
  } catch (e) { clearTimeout(t); return FALLBACK[category] || FALLBACK.geral; }
}

module.exports = { generateReply };
