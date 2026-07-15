'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.GROQ_API_KEY;
const { detectIntent } = require('../intent');
const { detectHuman } = require('../menu');

test('identifica pedidos de agendamento', async () => {
  const intent = await detectIntent('Quero marcar uma avaliação');
  assert.equal(intent.category, 'agendamento');
});

test('identifica pedidos de remarcação', async () => {
  const intent = await detectIntent('Preciso remarcar minha consulta');
  assert.equal(intent.category, 'remarcar');
});

test('identifica confirmações que precisam da equipe', async () => {
  const intent = await detectIntent('Quero confirmar minha presença');
  assert.equal(intent.category, 'tarefa');
});

test('identifica pedido para falar com uma pessoa', () => {
  assert.equal(detectHuman('Quero falar com um atendente'), true);
});
