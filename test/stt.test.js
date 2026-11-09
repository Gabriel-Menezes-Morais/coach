const assert = require('node:assert/strict');
const { test } = require('node:test');
const { WebSocketServer } = require('ws');
const { SttStream } = require('../src/stt');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fakeServer(onConnection) {
  const server = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  server.on('connection', onConnection);
  return { server, url: `ws://127.0.0.1:${server.address().port}/realtime` };
}

test('manda o áudio no formato do serviço e devolve parcial e final', async () => {
  const received = [];
  let seenRequest;
  const { server, url } = await fakeServer((socket, request) => {
    seenRequest = request;
    socket.on('message', (data) => received.push(JSON.parse(data.toString())));
    socket.send(JSON.stringify({ message_type: 'session_started', session_id: 'x', config: {} }));
    socket.send(JSON.stringify({ message_type: 'partial_transcript', text: 'bom' }));
    socket.send(JSON.stringify({ message_type: 'committed_transcript', text: 'bom dia' }));
  });
  const events = [];
  const stream = new SttStream({
    source: 'them',
    apiKey: 'chave',
    language: 'por',
    url,
    onError: assert.fail,
    onTranscript: (e) => events.push(e),
  });
  await wait(60);
  stream.send(new Uint8Array([1, 2, 3, 4]));
  await wait(40);

  assert.equal(seenRequest.headers['xi-api-key'], 'chave');
  assert.match(seenRequest.url, /model_id=scribe_v2_realtime/);
  assert.match(seenRequest.url, /language_code=por/);
  assert.deepEqual(received[0], {
    message_type: 'input_audio_chunk',
    audio_base_64: 'AQIDBA==',
    commit: false,
    sample_rate: 16000,
  });
  assert.deepEqual(events, [
    { source: 'them', text: 'bom', final: false },
    { source: 'them', text: 'bom dia', final: true },
  ]);
  stream.close();
  server.close();
});

test('chave inválida para a sessão e não fica reconectando', async () => {
  let connections = 0;
  const { server, url } = await fakeServer((socket) => {
    connections += 1;
    socket.send(JSON.stringify({ message_type: 'auth_error', error: 'chave inválida' }));
  });
  const errors = [];
  const stream = new SttStream({
    source: 'me',
    apiKey: 'x',
    language: 'por',
    url,
    onTranscript: assert.fail,
    onError: (m) => errors.push(m),
  });
  await wait(800);
  assert.equal(connections, 1);
  assert.match(errors[0], /chave inválida/);
  stream.close();
  server.close();
});
