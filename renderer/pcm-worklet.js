// Runs inside the audio thread. Groups samples into 100 ms blocks of 16-bit PCM.
const BLOCK_SAMPLES = 1600;

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.block = new Int16Array(BLOCK_SAMPLES);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0][0];
    if (!channel) return true;
    for (const sample of channel) {
      const clipped = Math.max(-1, Math.min(1, sample));
      this.block[this.filled++] = clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;
      if (this.filled === BLOCK_SAMPLES) {
        this.port.postMessage(this.block.buffer, [this.block.buffer]);
        this.block = new Int16Array(BLOCK_SAMPLES);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
