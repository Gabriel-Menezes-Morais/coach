const { EventEmitter } = require('node:events');
const { buildUser } = require('./prompt');

const DEBOUNCE_MS = 350;
const MIN_NEW_CHARS = 12;
const MAX_LINES = 60;
const LABEL = { them: 'Cliente', me: 'Vendedor' };
const MIN_ECHO_WORDS = 3;
const ECHO_LINES = 6;
const ECHO_OVERLAP = 0.7;

const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

// Turns live transcript events into suggestions. It starts writing as soon as the
// client pauses, without waiting for the transcription service to close the sentence.
class Coach extends EventEmitter {
  constructor({ stream, system, debounceMs = DEBOUNCE_MS, minNewChars = MIN_NEW_CHARS }) {
    super();
    this.stream = stream;
    this.system = system;
    this.debounceMs = debounceMs;
    this.minNewChars = minNewChars;
    this.lines = [];
    this.partial = { me: '', them: '' };
    this.answeredChars = 0;
    this.timer = null;
    this.running = null;
    this.lastThemAt = 0;
  }

  // On laptop speakers the microphone also picks up the client's voice.
  isEcho(text) {
    const mine = words(text);
    if (mine.length < MIN_ECHO_WORDS) return false;
    const recent = this.lines.filter((l) => l.source === 'them').slice(-ECHO_LINES).map((l) => l.text);
    const theirs = new Set(words([...recent, this.partial.them].join(' ')));
    return mine.filter((word) => theirs.has(word)).length / mine.length >= ECHO_OVERLAP;
  }

  onTranscript({ source, text, final }) {
    const clean = text.trim();
    if (source === 'me' && this.isEcho(clean)) {
      this.partial.me = '';
      return;
    }
    if (final) {
      this.partial[source] = '';
      if (clean) this.lines.push({ source, text: clean });
      this.lines = this.lines.slice(-MAX_LINES);
    } else {
      this.partial[source] = clean;
    }
    if (source !== 'them') return;
    this.lastThemAt = Date.now();
    // The client kept talking: what is being written may already be outdated.
    if (this.running && this.themChars() - this.running.chars >= this.minNewChars) this.cancel();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.maybeGenerate(), this.debounceMs);
  }

  themChars() {
    const said = this.lines.filter((l) => l.source === 'them').reduce((n, l) => n + l.text.length, 0);
    return said + this.partial.them.length;
  }

  transcript() {
    const lines = this.lines.map((l) => `${LABEL[l.source]}: ${l.text}`);
    for (const source of ['me', 'them']) {
      if (this.partial[source]) lines.push(`${LABEL[source]}: ${this.partial[source]}`);
    }
    return lines.join('\n');
  }

  cancel() {
    if (this.running) this.running.controller.abort();
    this.running = null;
  }

  async maybeGenerate() {
    const chars = this.themChars();
    if (this.running || chars - this.answeredChars < this.minNewChars) return;
    this.answeredChars = chars;

    const run = { controller: new AbortController(), chars };
    this.running = run;
    const spokenAt = this.lastThemAt;
    let text = '';
    try {
      await this.stream({
        system: this.system,
        user: buildUser(this.transcript()),
        signal: run.controller.signal,
        onText: (delta) => {
          if (this.running !== run) return;
          if (!text) this.emit('first', { latencyMs: Date.now() - spokenAt });
          text += delta;
          this.emit('text', text);
        },
      });
    } catch (err) {
      if (!run.controller.signal.aborted) this.emit('error', err);
    } finally {
      if (this.running === run) this.running = null;
    }
  }

  stop() {
    clearTimeout(this.timer);
    this.cancel();
  }
}

module.exports = { Coach };
