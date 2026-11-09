import { chat, parseJsonAnswer, prompt } from '../lib/model.mjs';
import { maskPii } from '../lib/pii.mjs';

export const reviewReply = async (body) => {
  const ticket = maskPii(body.ticket ?? '');
  const reply = maskPii(body.reply ?? '');
  const agent = String(body.agent ?? '');
  const answer = await chat({
    feature: 'reviews',
    json: true,
    maxTokens: 220,
    messages: [
      { role: 'system', content: prompt('reviews') },
      { role: 'user', content: `TICKET:\n${ticket.text}\n\nREPLY THE AGENT SENT:\n${reply.text}` },
    ],
  });
  const parsed = parseJsonAnswer(answer.text);
  const policy = String(parsed.policy ?? '').toLowerCase() === 'breaks' ? 'breaks' : 'follows';
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  return {
    agent,
    // A reply that breaks the refund policy never reads as a good review, whatever the model scored.
    score: policy === 'breaks' ? Math.min(score, 59) : score,
    policy,
    tone: String(parsed.tone ?? ''),
    coaching: String(parsed.coaching ?? ''),
    masked: [...new Set([...ticket.masked, ...reply.masked])].sort(),
    model: answer.model,
    usage: answer.usage,
    latencyMs: answer.latencyMs,
  };
};
