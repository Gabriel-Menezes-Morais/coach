const el = (id) => document.getElementById(id);
const say = el('say');
const heard = el('heard');
const status = el('status');
const toggle = el('toggle');
const clientSelect = el('client');

let capture = null;

function setStatus(text, kind = '') {
  status.textContent = text;
  status.className = `status ${kind}`;
}

async function pipeToMain(context, stream, source) {
  const node = new AudioWorkletNode(context, 'pcm-processor');
  node.port.onmessage = (event) => window.coach.sendAudio(source, new Uint8Array(event.data));
  context.createMediaStreamSource(stream).connect(node);
}

async function startCapture() {
  const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  // Only the sound matters; the picture is never used.
  display.getVideoTracks().forEach((track) => track.stop());
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const context = new AudioContext({ sampleRate: 16000 });
  await context.audioWorklet.addModule('pcm-worklet.js');
  await pipeToMain(context, display, 'them');
  await pipeToMain(context, mic, 'me');
  return { context, tracks: [...display.getAudioTracks(), ...mic.getAudioTracks()] };
}

function stopCapture() {
  if (!capture) return;
  capture.tracks.forEach((track) => track.stop());
  capture.context.close();
  capture = null;
}

async function start() {
  toggle.disabled = true;
  try {
    const result = await window.coach.start(clientSelect.value);
    if (result.error) return setStatus(result.error, 'error');
    capture = await startCapture();
    toggle.textContent = 'Parar';
    say.textContent = 'Ouvindo a call.';
    heard.textContent = '';
    setStatus('Ao vivo', 'live');
  } catch (err) {
    await window.coach.stop();
    setStatus(`Não consegui capturar o áudio: ${err.message}`, 'error');
  } finally {
    toggle.disabled = false;
  }
}

async function stop() {
  stopCapture();
  await window.coach.stop();
  toggle.textContent = 'Iniciar';
  setStatus('Parado');
}

async function loadClients() {
  const clients = await window.coach.listClients();
  clientSelect.replaceChildren(new Option('Sem cliente', ''), ...clients.map((name) => new Option(name, name)));
}

toggle.addEventListener('click', () => (capture ? stop() : start()));
clientSelect.addEventListener('focus', loadClients);
el('settings').addEventListener('click', () => window.coach.openSettings());
el('quit').addEventListener('click', () => window.coach.quit());

window.coach.onFirst(({ latencyMs }) => setStatus(`Ao vivo  ${(latencyMs / 1000).toFixed(1)} s`, 'live'));
window.coach.onText((text) => {
  say.textContent = text;
});
window.coach.onHeard((text) => {
  heard.textContent = text;
});
window.coach.onError((message) => setStatus(message, 'error'));

loadClients();
