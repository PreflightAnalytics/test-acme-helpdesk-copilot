import { chat, parseJsonAnswer, prompt } from '../lib/model.mjs';
import { maskPii } from '../lib/pii.mjs';

const AREAS = ['billing', 'shipping', 'returns', 'warranty', 'account', 'catalog'];

export const tag = async (body) => {
  const ticket = body.ticket ? `${body.ticket.subject ?? ''}\n\n${body.ticket.body ?? ''}` : body.message ?? '';
  const { text } = maskPii(ticket);
  const answer = await chat({
    feature: 'tags',
    json: true,
    maxTokens: 80,
    messages: [
      { role: 'system', content: prompt('tags') },
      { role: 'user', content: text },
    ],
  });
  const parsed = parseJsonAnswer(answer.text);
  const area = String(parsed.productArea ?? '').toLowerCase();
  return {
    productArea: AREAS.includes(area) ? area : 'catalog',
    reason: String(parsed.reason ?? ''),
    model: answer.model,
    usage: answer.usage,
    latencyMs: answer.latencyMs,
  };
};
