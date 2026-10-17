// One OpenAI-compatible chat client for every feature. It runs the tool loop, and sums
// the token usage of every call so a response reports what the whole answer cost.
import { readFileSync } from 'node:fs';

const MODELS = JSON.parse(readFileSync(new URL('../../config/models.json', import.meta.url), 'utf8'));
const BASE = process.env.MODEL_BASE_URL ?? 'http://localhost:11434/v1';
const MAX_TOOL_ROUNDS = 4;

export const modelFor = (feature) => MODELS[feature];
export const models = () => ({ ...MODELS });

export const prompt = (name) => readFileSync(new URL(`../../prompts/${name}.md`, import.meta.url), 'utf8').trim();

const call = async (body) => {
  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.MODEL_API_KEY ?? 'local'}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`model ${body.model} answered ${response.status}: ${await response.text()}`);
  return response.json();
};

export const chat = async ({ feature, messages, json = false, maxTokens = 300, tools, runTool }) => {
  const started = Date.now();
  const model = MODELS[feature];
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const toolCalls = [];
  const conversation = [...messages];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const body = await call({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      messages: conversation,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      ...(tools && round < MAX_TOOL_ROUNDS ? { tools } : {}),
    });
    usage.inputTokens += body.usage?.prompt_tokens ?? 0;
    usage.outputTokens += body.usage?.completion_tokens ?? 0;
    usage.totalTokens += body.usage?.total_tokens ?? 0;
    const message = body.choices?.[0]?.message ?? {};
    const calls = message.tool_calls ?? [];
    if (calls.length === 0 || !runTool) {
      return { text: (message.content ?? '').trim(), model: body.model ?? model, usage, toolCalls, latencyMs: Date.now() - started };
    }
    conversation.push(message);
    for (const toolCall of calls) {
      const name = toolCall.function?.name;
      let args = {};
      try { args = JSON.parse(toolCall.function?.arguments ?? '{}'); } catch { args = {}; }
      const result = await runTool(name, args);
      toolCalls.push({ name, arguments: args, result });
      conversation.push({ role: 'tool', tool_call_id: toolCall.id, name, content: JSON.stringify(result) });
    }
  }
  throw new Error('the model kept calling tools without answering');
};

/** Reads a JSON answer, tolerating a model that wraps it in prose or a code fence. */
export const parseJsonAnswer = (text) => {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`the model did not answer with JSON: ${text.slice(0, 120)}`);
  return JSON.parse(match[0]);
};
