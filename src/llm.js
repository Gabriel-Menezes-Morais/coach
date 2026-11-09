// Every model call in the app goes through this file.
const Anthropic = require('@anthropic-ai/sdk');

const MAX_TOKENS = 1000;

// Consumes complete "data:" lines of an OpenAI-style stream and returns what is left over.
function consumeSse(buffer, onText) {
  const lines = buffer.split('\n');
  const rest = lines.pop();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') continue;
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    const text = parsed.choices?.[0]?.delta?.content;
    if (text) onText(text);
  }
  return rest;
}

function anthropicStreamer({ apiKey, model }) {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  // Haiku can skip thinking entirely, which is the fastest path to the first word.
  const thinking = model.includes('haiku') ? { thinking: { type: 'disabled' } } : {};
  return async ({ system, user, signal, onText }) => {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: MAX_TOKENS,
        ...thinking,
        output_config: { effort: 'low' },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      },
      { signal },
    );
    stream.on('text', onText);
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new Error('O modelo recusou esta resposta.');
  };
}

function openAiStreamer({ baseUrl, apiKey, model, headers, body }) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  return async ({ system, user, signal, onText }) => {
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        ...body,
        model,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Modelo respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body) {
      buffer = consumeSse(buffer + decoder.decode(chunk, { stream: true }), onText);
    }
  };
}

function createStreamer(settings) {
  if (settings.provider === 'openai-compatible') {
    return openAiStreamer({
      baseUrl: settings.openaiBaseUrl,
      apiKey: settings.openaiKey,
      model: settings.model,
      headers: settings.openaiHeaders,
      body: settings.openaiBody,
    });
  }
  return anthropicStreamer({ apiKey: settings.anthropicKey, model: settings.model });
}

module.exports = { createStreamer, consumeSse };
