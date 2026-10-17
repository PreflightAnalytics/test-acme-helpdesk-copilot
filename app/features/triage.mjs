import { chat, parseJsonAnswer, prompt } from '../lib/model.mjs';
import { maskPii } from '../lib/pii.mjs';

const CATEGORIES = ['returns', 'delivery', 'account', 'product', 'other'];
const PRIORITIES = ['urgent', 'normal', 'low'];
const SENTIMENTS = ['positive', 'neutral', 'negative'];
const pick = (value, allowed, fallback) => (allowed.includes(String(value ?? '').toLowerCase()) ? String(value).toLowerCase() : fallback);

export const triage = async (body) => {
  const ticket = body.ticket ? `${body.ticket.subject ?? ''}\n\n${body.ticket.body ?? ''}` : body.message ?? '';
  const { text, masked } = maskPii(ticket);
  const answer = await chat({
    feature: 'triage',
    json: true,
    maxTokens: 160,
    messages: [
      { role: 'system', content: prompt('triage') },
      { role: 'user', content: text },
    ],
  });
  const parsed = parseJsonAnswer(answer.text);
  return {
    category: pick(parsed.category, CATEGORIES, 'other'),
    priority: pick(parsed.priority, PRIORITIES, 'normal'),
    sentiment: pick(parsed.sentiment, SENTIMENTS, 'neutral'),
    language: String(parsed.language ?? 'en').toLowerCase().slice(0, 2),
    needsHuman: parsed.needsHuman === true || parsed.needsHuman === 'true',
    reason: String(parsed.reason ?? ''),
    masked,
    model: answer.model,
    usage: answer.usage,
    latencyMs: answer.latencyMs,
  };
};
