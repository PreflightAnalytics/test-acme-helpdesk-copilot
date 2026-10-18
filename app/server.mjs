// Acme Support's helpdesk copilot: triage, reply drafting with order tools, thread
// summaries and help-center answers, each on the model config/models.json names for it.
import { createServer } from 'node:http';

import { answer } from './features/answers.mjs';
import { draftReply } from './features/replies.mjs';
import { summarise } from './features/summaries.mjs';
import { triage } from './features/triage.mjs';
import { models } from './lib/model.mjs';

const PORT = Number(process.env.PORT ?? 4300);
const MAX_BODY = 64 * 1024;

const readJson = (request) =>
  new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) reject(Object.assign(new Error('request too large'), { status: 413 }));
    });
    request.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(Object.assign(new Error('the body is not JSON'), { status: 400 })); }
    });
  });

const send = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

/** A damage photo for an order: multipart only, as the agent inbox uploads it. */
const receiveAttachment = (request, response) =>
  new Promise((resolve) => {
    const type = request.headers['content-type'] ?? '';
    let size = 0;
    let head = '';
    request.on('data', (chunk) => {
      size += chunk.length;
      if (head.length < 2048) head += chunk.toString('latin1');
    });
    request.on('end', () => {
      if (!type.startsWith('multipart/form-data')) return resolve(send(response, 415, { error: 'send the photo as multipart/form-data' }));
      if (!/name="photo"/.test(head)) return resolve(send(response, 400, { error: 'the photo field is missing' }));
      return resolve(send(response, 201, { attachmentId: `att_${Date.now().toString(36)}`, bytes: size }));
    });
  });

export const routes = {
  'POST /v1/triage': triage,
  'POST /v1/replies': draftReply,
  'POST /v1/summaries': summarise,
  'POST /v1/answers': answer,
};

/** Requests served since start, by route: what the support leads' usage report reads. */
const served = {};

/** The support leads' usage report: behind its own admin token, never the agents' key. */
const usageReport = (request, response) => {
  const token = process.env.ACME_ADMIN_TOKEN;
  if (!token) return send(response, 503, { error: 'usage reports are not configured' });
  if (request.headers.authorization !== `Bearer ${token}`) return send(response, 401, { error: 'the usage report needs the admin token' });
  const total = Object.values(served).reduce((sum, count) => sum + count, 0);
  return send(response, 200, { requestsServed: total, byRoute: served });
};

export const server = createServer(async (request, response) => {
  const key = `${request.method} ${request.url?.split('?')[0]}`;
  try {
    if (key === 'GET /health') return send(response, 200, { status: 'ok', models: models() });
    // Production sits behind an API key; set ACME_API_KEY and every /v1 route asks for it.
    if (process.env.ACME_API_KEY && request.headers['x-acme-key'] !== process.env.ACME_API_KEY) {
      return send(response, 401, { error: 'missing or wrong x-acme-key' });
    }
    if (key === 'GET /v1/usage') return usageReport(request, response);
    if (key === 'POST /v1/attachments') return receiveAttachment(request, response);
    const route = routes[key];
    if (!route) return send(response, 404, { error: 'not found' });
    const answered = await route(await readJson(request));
    served[key] = (served[key] ?? 0) + 1;
    return send(response, 200, answered);
  } catch (error) {
    return send(response, error.status ?? 502, { error: String(error.message ?? error) });
  }
});

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  server.listen(PORT, '127.0.0.1', () => console.log(`helpdesk copilot on http://127.0.0.1:${PORT}, models ${JSON.stringify(models())}`));
}
