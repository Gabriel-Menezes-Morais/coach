const el = (id) => document.getElementById(id);
const SECRETS = ['elevenlabsKey', 'anthropicKey', 'openaiKey'];
const PLAIN = ['language', 'provider', 'model', 'openaiBaseUrl'];
const JSON_FIELDS = ['openaiHeaders', 'openaiBody'];

function syncProvider() {
  const gateway = el('provider').value === 'openai-compatible';
  el('gateway').hidden = !gateway;
  el('anthropic').hidden = gateway;
}

function show(view) {
  PLAIN.forEach((key) => {
    el(key).value = view[key];
  });
  SECRETS.forEach((key) => {
    el(key).value = '';
    el(key).placeholder = view[`${key}Saved`] ? 'Salva' : 'Não configurada';
  });
  JSON_FIELDS.forEach((key) => {
    el(key).value = Object.keys(view[key]).length ? JSON.stringify(view[key], null, 2) : '';
  });
  syncProvider();
}

el('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const changes = {};
  PLAIN.forEach((key) => {
    changes[key] = el(key).value.trim();
  });
  SECRETS.forEach((key) => {
    if (el(key).value.trim()) changes[key] = el(key).value.trim();
  });
  try {
    JSON_FIELDS.forEach((key) => {
      changes[key] = el(key).value.trim() ? JSON.parse(el(key).value) : {};
    });
  } catch {
    el('message').textContent = 'Algum campo em JSON está inválido.';
    return;
  }
  show(await window.coach.saveSettings(changes));
  el('message').textContent = 'Salvo.';
});

el('provider').addEventListener('change', syncProvider);
el('contexts').addEventListener('click', () => window.coach.openContexts());

window.coach.getSettings().then(show);
