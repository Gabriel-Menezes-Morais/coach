const WebSocket = require('ws');

const DEFAULT_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const SAMPLE_RATE = 16000;
const RECONNECT_MS = 500;
const FATAL = new Set(['auth_error', 'quota_exceeded', 'unaccepted_terms']);

// One live transcription session. Each audio source (client, seller) gets its own,
// so every line already knows who said it.
class SttStream {
  constructor({ source, apiKey, language, onTranscript, onError, url = process.env.COACH_STT_URL || DEFAULT_URL }) {
    Object.assign(this, { source, apiKey, language, onTranscript, onError, url });
    this.closed = false;
    this.connect();
  }

  connect() {
    const query = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      language_code: this.language,
      audio_format: 'pcm_16000',
      commit_strategy: 'vad',
    });
    this.ws = new WebSocket(`${this.url}?${query}`, { headers: { 'xi-api-key': this.apiKey } });
    this.ws.on('message', (data) => this.handle(data));
    this.ws.on('error', (err) => this.onError(`Transcrição: ${err.message}`));
    this.ws.on('close', () => {
      if (!this.closed) setTimeout(() => !this.closed && this.connect(), RECONNECT_MS);
    });
  }

  handle(data) {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    const { message_type: type, text, error } = msg;
    if (type === 'partial_transcript') {
      this.onTranscript({ source: this.source, text, final: false });
    } else if (type === 'committed_transcript') {
      this.onTranscript({ source: this.source, text, final: true });
    } else if (error) {
      this.onError(`Transcrição (${type}): ${error}`);
      if (FATAL.has(type)) this.close();
    }
  }

  send(pcm) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: Buffer.from(pcm).toString('base64'),
        commit: false,
        sample_rate: SAMPLE_RATE,
      }),
    );
  }

  close() {
    this.closed = true;
    this.ws.close();
  }
}

module.exports = { SttStream };
