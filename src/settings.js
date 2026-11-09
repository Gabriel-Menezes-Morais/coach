const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  elevenlabsKey: '',
  provider: 'anthropic',
  anthropicKey: '',
  model: 'claude-haiku-5-5',
  openaiBaseUrl: '',
  openaiKey: '',
  openaiHeaders: {},
  openaiBody: {},
  language: 'por',
};
const SECRETS = ['elevenlabsKey', 'anthropicKey', 'openaiKey'];

// Settings live in the user's profile, outside the code. Keys are encrypted with the
// Windows account through Electron safeStorage.
class SettingsStore {
  constructor({ file, crypto }) {
    this.file = file;
    this.crypto = crypto;
  }

  load() {
    let stored = {};
    try {
      stored = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return { ...DEFAULTS };
    }
    const settings = { ...DEFAULTS, ...stored };
    for (const key of SECRETS) {
      if (settings[key]) settings[key] = this.crypto.decryptString(Buffer.from(settings[key], 'base64'));
    }
    return settings;
  }

  save(changes) {
    const merged = { ...this.load(), ...changes };
    const stored = { ...merged };
    for (const key of SECRETS) {
      if (stored[key]) stored[key] = this.crypto.encryptString(stored[key]).toString('base64');
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(stored, null, 2));
    return merged;
  }

  // What the settings screen may see: never a key, only whether it exists.
  publicView() {
    const settings = this.load();
    const view = { ...settings };
    for (const key of SECRETS) {
      view[key] = '';
      view[`${key}Saved`] = Boolean(settings[key]);
    }
    return view;
  }
}

function missingSetup(settings) {
  if (!settings.elevenlabsKey) return 'Falta a chave do ElevenLabs. Abra as configurações na engrenagem.';
  if (settings.provider === 'openai-compatible') {
    if (!settings.openaiBaseUrl || !settings.openaiKey) return 'Falta a URL ou a chave do modelo. Abra as configurações.';
  } else if (!settings.anthropicKey) {
    return 'Falta a chave da Anthropic. Abra as configurações na engrenagem.';
  }
  return null;
}

module.exports = { SettingsStore, missingSetup, DEFAULTS };
