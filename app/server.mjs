// Acme Support's helpdesk copilot: triage, reply drafting and thread summaries,
// each answered by the model config/models.json names for it, on an OpenAI-compatible endpoint.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const MODELS = JSON.parse(readFileSync(new URL('../config/models.json', import.meta.url), 'utf8'));
const BASE = process.env.MODEL_BASE_URL ?? 'http://localhost:11434/v1';
const PORT = Number(process.env.PORT ?? 4300);

const PROMPTS = {
  triage:
    'You triage customer support tickets for an online shop. Reply with exactly one word: refund, shipping, account or other. A damaged or broken item is a refund; a late or lost parcel is shipping.',
  replies:
    'You draft the first reply a support agent sends. Be brief and polite, one sentence, and name the order number. Never promise a refund.',
  summaries:
    'Summarise the support thread in one sentence for the next agent. Name the order number if there is one.',
};

const ask = async (feature, message, maxTokens) => {
  const started = Date.now();
  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.MODEL_API_KEY ?? 'local'}` },
    body: JSON.stringify({
      model: MODELS[feature],
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: PROMPTS[feature] },
        { role: 'user', content: message },
      ],
    }),
  });
  if (!response.ok) throw new Error(`model ${MODELS[feature]} answered ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const usage = body.usage ?? {};
  return {
    text: body.choices?.[0]?.message?.content?.trim() ?? '',
    model: body.model ?? MODELS[feature],
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    },
    latencyMs: Date.now() - started,
  };
};

const readJson = (request) =>
  new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => (raw += chunk));
    request.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
    });
  });

const send = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

const routes = {
  'POST /v1/triage': async (body) => {
    const r = await ask('triage', body.message ?? '', 10);
    return { category: r.text.toLowerCase().replace(/[^a-z]/g, ''), model: r.model, usage: r.usage, latencyMs: r.latencyMs };
  },
  'POST /v1/replies': async (body) => {
    const r = await ask('replies', body.message ?? '', 120);
    return { reply: r.text, model: r.model, usage: r.usage, latencyMs: r.latencyMs };
  },
  'POST /v1/summaries': async (body) => {
    const r = await ask('summaries', (body.thread ?? []).join('\n'), 80);
    return { summary: r.text, model: r.model, usage: r.usage, latencyMs: r.latencyMs };
  },
};

createServer(async (request, response) => {
  const key = `${request.method} ${request.url?.split('?')[0]}`;
  try {
    if (key === 'GET /health') return send(response, 200, { status: 'ok', models: MODELS });
    const route = routes[key];
    if (!route) return send(response, 404, { error: 'not found' });
    return send(response, 200, await route(await readJson(request)));
  } catch (error) {
    return send(response, 502, { error: String(error.message ?? error) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`helpdesk copilot on http://127.0.0.1:${PORT}, models ${JSON.stringify(MODELS)}`));
