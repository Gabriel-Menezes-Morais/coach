const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Coach } = require('../src/coach');
const { consumeSse } = require('../src/llm');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const them = (text, final = false) => ({ source: 'them', text, final });

function coachWith(stream) {
  return new Coach({ stream, system: 'S', debounceMs: 10, minNewChars: 12 });
}

test('escreve quando o cliente pausa, sem esperar a frase ser fechada', async () => {
  const prompts = [];
  const coach = coachWith(async ({ user, onText }) => {
    prompts.push(user);
    onText('Quantas pessoas ');
    onText('fazem isso hoje?');
  });
  const seen = [];
  coach.on('text', (t) => seen.push(t));
  coach.onTranscript(them('A gente perde muito tempo com isso'));
  await wait(40);
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /Cliente: A gente perde muito tempo/);
  assert.equal(seen.at(-1), 'Quantas pessoas fazem isso hoje?');
});

test('não gera de novo quando a transcrição só confirma a mesma frase', async () => {
  let calls = 0;
  const coach = coachWith(async () => {
    calls += 1;
  });
  coach.onTranscript(them('A gente perde muito tempo com isso'));
  await wait(40);
  coach.onTranscript(them('A gente perde muito tempo com isso.', true));
  await wait(40);
  assert.equal(calls, 1);
});

test('ignora fala curta do cliente', async () => {
  let calls = 0;
  const coach = coachWith(async () => {
    calls += 1;
  });
  coach.onTranscript(them('sim'));
  await wait(40);
  assert.equal(calls, 0);
});

test('a fala do vendedor entra na conversa, mas não dispara sugestão', async () => {
  const prompts = [];
  const coach = coachWith(async ({ user }) => prompts.push(user));
  coach.onTranscript({ source: 'me', text: 'Qual é o volume mensal de vocês?', final: true });
  await wait(40);
  assert.equal(prompts.length, 0);
  coach.onTranscript(them('Umas duas mil notas por mês', true));
  await wait(40);
  assert.match(prompts[0], /Vendedor: Qual é o volume[\s\S]*Cliente: Umas duas mil/);
});

test('descarta o eco da voz do cliente captado pelo microfone', async () => {
  const prompts = [];
  const coach = coachWith(async ({ user }) => prompts.push(user));
  coach.onTranscript(them('Nosso processo hoje é todo manual e demora demais', true));
  coach.onTranscript({ source: 'me', text: 'nosso processo hoje é todo manual', final: true });
  coach.onTranscript({ source: 'me', text: 'Quantas pessoas cuidam disso na equipe?', final: true });
  await wait(40);
  assert.doesNotMatch(prompts[0], /Vendedor: nosso processo/);
  assert.match(prompts[0], /Vendedor: Quantas pessoas/);
});

test('cancela a sugestão quando o cliente continua falando', async () => {
  const signals = [];
  const coach = coachWith(
    ({ signal }) =>
      new Promise((resolve) => {
        signals.push(signal);
        signal.addEventListener('abort', resolve);
        setTimeout(resolve, 200);
      }),
  );
  coach.onTranscript(them('Primeira parte da fala do cliente'));
  await wait(30);
  coach.onTranscript(them('Primeira parte da fala do cliente e agora ele mudou de assunto'));
  assert.equal(signals[0].aborted, true);
  await wait(30);
  assert.equal(signals.length, 2);
  coach.stop();
});

test('avisa o erro do modelo', async () => {
  const coach = coachWith(async () => {
    throw new Error('falhou');
  });
  const errors = [];
  coach.on('error', (e) => errors.push(e.message));
  coach.onTranscript(them('Uma frase longa o bastante do cliente'));
  await wait(40);
  assert.deepEqual(errors, ['falhou']);
});

test('lê o stream em pedaços quebrados no meio da linha', () => {
  const out = [];
  const onText = (t) => out.push(t);
  let rest = consumeSse('data: {"choices":[{"delta":{"content":"Ol', onText);
  rest = consumeSse(`${rest}á"}}]}\ndata: {"choices":[{"delta":{"content":" mundo"}}]}\ndata: [DONE]\n`, onText);
  assert.deepEqual(out, ['Olá', ' mundo']);
  assert.equal(rest, '');
});
