import { chat, parseJsonAnswer, prompt } from '../lib/model.mjs';
import { maskPii } from '../lib/pii.mjs';

const line = (entry) => (typeof entry === 'string' ? entry : `${entry.from ?? 'customer'}: ${entry.text ?? ''}`);

export const summarise = async (body) => {
  const { text, masked } = maskPii((body.thread ?? []).map(line).join('\n'));
  const answer = await chat({
    feature: 'summaries',
    json: true,
    maxTokens: 700,
    messages: [
      { role: 'system', content: prompt('summaries') },
      { role: 'user', content: text },
    ],
  });
  const parsed = parseJsonAnswer(answer.text);
  return {
    summary: String(parsed.summary ?? ''),
    orderNumbers: Array.isArray(parsed.orderNumbers) ? parsed.orderNumbers.map(String) : [],
    timeline: Array.isArray(parsed.timeline) ? parsed.timeline.map(String) : [],
    promised: Array.isArray(parsed.promised) ? parsed.promised.map(String) : [],
    openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map(String) : [],
    customerMood: String(parsed.customerMood ?? ''),
    nextAction: String(parsed.nextAction ?? ''),
    masked,
    model: answer.model,
    usage: answer.usage,
    latencyMs: answer.latencyMs,
  };
};
