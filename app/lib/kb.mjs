// Help-center retrieval: scores each article by the question's words it contains and
// returns the best ones. Small and explainable, like the first version most teams ship.
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../kb/', import.meta.url);
const STOP = new Set('a an the and or of to in on for with my your is are was it i you we our me can how what when do does did be by at from this that'.split(' '));
const words = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g)?.filter((word) => !STOP.has(word) && word.length > 2) ?? [];

const ARTICLES = readdirSync(DIR).filter((file) => file.endsWith('.md')).map((file) => {
  const text = readFileSync(new URL(file, DIR), 'utf8');
  const id = text.match(/^id:\s*(\S+)/m)?.[1] ?? file.replace(/\.md$/, '');
  const title = text.match(/^#\s*(.+)$/m)?.[1] ?? id;
  const body = text.replace(/^#.*$/m, '').replace(/^id:.*$/m, '').trim();
  return { id, title, body, terms: new Set(words(`${title} ${body}`)) };
});

export const search = (question, limit = 2) => {
  const asked = [...new Set(words(question))];
  return ARTICLES
    .map((article) => ({ article, score: asked.filter((word) => article.terms.has(word)).length }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ article }) => ({ id: article.id, title: article.title, body: article.body }));
};
