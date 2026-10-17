import { search } from '../lib/kb.mjs';
import { chat, prompt } from '../lib/model.mjs';
import { maskPii } from '../lib/pii.mjs';

const NOT_COVERED = "I don't have that in our help center, so a colleague will reply.";

export const answer = async (body) => {
  const { text, masked } = maskPii(body.question ?? '');
  const articles = search(text);
  if (articles.length === 0) {
    // Nothing to ground an answer in: hand over without asking the model to guess.
    return { answer: NOT_COVERED, citations: [], retrieval: [], masked };
  }
  const result = await chat({
    feature: 'answers',
    maxTokens: 160,
    messages: [
      { role: 'system', content: prompt('answers') },
      { role: 'user', content: `${articles.map((article) => `[${article.id}] ${article.title}\n${article.body}`).join('\n\n')}\n\nQuestion: ${text}` },
    ],
  });
  const citations = [...new Set(result.text.match(/kb-[a-z-]+/g) ?? [])].filter((id) => articles.some((article) => article.id === id));
  return {
    answer: result.text,
    citations,
    retrieval: articles.map((article) => ({ documentId: article.id, title: article.title })),
    masked,
    model: result.model,
    usage: result.usage,
    latencyMs: result.latencyMs,
  };
};
