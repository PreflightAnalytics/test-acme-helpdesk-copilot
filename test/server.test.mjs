import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

// A fake OpenAI-compatible model: answers triage with JSON and asks for one tool call on replies.
let calls = 0;
const fake = createServer((request, response) => {
  let raw = '';
  request.on('data', (chunk) => (raw += chunk));
  request.on('end', () => {
    calls += 1;
    const body = JSON.parse(raw);
    const system = body.messages[0].content;
    const usage = { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 };
    let message = { role: 'assistant', content: 'ok' };
    if (system.includes('triage')) message.content = JSON.stringify({ category: 'refund', priority: 'normal', sentiment: 'negative', language: 'en', needsHuman: false, reason: 'Broken item.' });
    if (system.includes('first reply') && !body.messages.some((entry) => entry.role === 'tool')) {
      message = { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'lookup_order', arguments: '{"orderId":"2210"}' } }] };
    } else if (system.includes('first reply')) message.content = 'Sorry about order 2210, Tom. Acme Support';
    if (system.includes('You polish')) message = { role: 'assistant', content: body.messages[1].content };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ model: body.model, choices: [{ message }], usage }));
  });
});

let base;
let app;
before(async () => {
  await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
  process.env.MODEL_BASE_URL = `http://127.0.0.1:${fake.address().port}/v1`;
  ({ server: app } = await import('../app/server.mjs'));
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.address().port}`;
});
after(() => { app.close(); fake.close(); });

const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

test('triage answers structured JSON with the model and its usage', async () => {
  const result = await post('/v1/triage', { message: 'My mug from order 2210 arrived broken. Mail me at tom@example.co.uk' });
  assert.equal(result.category, 'refund');
  assert.deepEqual(result.masked, ['email']);
  assert.equal(result.usage.totalTokens, 60);
});

test('a reply is grounded in the order and the refund policy, polished, and sums the usage of every call', async () => {
  const result = await post('/v1/replies', { message: 'Order 2210 arrived broken.' });
  assert.deepEqual(result.toolCalls.slice(0, 2).map((call) => call.name), ['lookup_order', 'check_refund_policy']);
  assert.deepEqual(result.toolCalls[1].arguments, { orderId: '2210', reason: 'damaged' });
  assert.deepEqual(result.policy, { eligible: true, rule: 2 });
  assert.match(result.reply, /2210/);
  assert.equal(result.usage.totalTokens, 180);
});

test('a question the help center does not cover never reaches the model', async () => {
  const before = calls;
  const result = await post('/v1/answers', { question: 'Do you sell garden furniture in Brazil?' });
  assert.deepEqual(result.retrieval, []);
  assert.equal(calls, before);
});

test('the usage report answers only the admin token, and says when it is not set up', async () => {
  delete process.env.ACME_ADMIN_TOKEN;
  assert.equal((await fetch(`${base}/v1/usage`)).status, 503);
  process.env.ACME_ADMIN_TOKEN = 'lead-token-for-tests';
  assert.equal((await fetch(`${base}/v1/usage`, { headers: { authorization: 'Bearer wrong' } })).status, 401);
  const report = await fetch(`${base}/v1/usage`, { headers: { authorization: 'Bearer lead-token-for-tests' } });
  assert.equal(report.status, 200);
  assert.ok((await report.json()).requestsServed >= 1);
  delete process.env.ACME_ADMIN_TOKEN;
});
