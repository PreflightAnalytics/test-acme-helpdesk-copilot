import { chat, prompt } from '../lib/model.mjs';
import { checkRefundPolicy, lookupOrder } from '../lib/orders.mjs';
import { maskPii } from '../lib/pii.mjs';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lookup_order',
      description: 'Look up an Acme order by its number: status, dates, items, carrier and the customer’s first name and language.',
      parameters: { type: 'object', properties: { orderId: { type: 'string', description: 'The order number, e.g. 2210' } }, required: ['orderId'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_refund_policy',
      description: 'Check what Acme’s refund policy allows for an order and a reason.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          reason: { type: 'string', enum: ['change_of_mind', 'damaged', 'late', 'lost'] },
        },
        required: ['orderId', 'reason'],
      },
    },
  },
];

const runTool = async (name, args) => {
  if (name === 'lookup_order') return lookupOrder(args.orderId);
  if (name === 'check_refund_policy') return checkRefundPolicy(args.orderId, args.reason);
  return { error: `unknown tool ${name}` };
};

const REASONS = [
  ['damaged', /\b(broken|damaged|cracked|shattered|snapped|faulty|defective|kaputt|partid[oa]|roto|rota|cass[ée]e?)\b/i],
  ['lost', /\b(lost|never arrived|perdid[oa]|verloren|perdu)\b/i],
  ['late', /\b(late|where is|not arrived|still waiting|atrasad[oa]|versp[äa]tet|en retard|retrasad[oa])\b/i],
];
const reasonOf = (text) => REASONS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'change_of_mind';

/** Grounds the reply: the app looks the order and the policy up itself, as tool calls. */
const groundFacts = (text, orderId) => {
  const id = orderId ?? text.match(/\b\d{4}\b/)?.[0];
  if (!id) return { facts: null, calls: [] };
  const order = lookupOrder(id);
  if (!order.found) return { facts: { order }, calls: [{ name: 'lookup_order', arguments: { orderId: id }, result: order }] };
  const reason = reasonOf(text);
  const policy = checkRefundPolicy(id, reason);
  return {
    facts: { order, policy: { reason, ...policy } },
    calls: [
      { name: 'lookup_order', arguments: { orderId: id }, result: order },
      { name: 'check_refund_policy', arguments: { orderId: id, reason }, result: policy },
    ],
  };
};

export const draftReply = async (body) => {
  const message = body.ticket ? `${body.ticket.subject ?? ''}\n\n${body.ticket.body ?? ''}` : body.message ?? '';
  const { text, masked } = maskPii(message);
  const grounded = groundFacts(text, body.orderId);
  const answer = await chat({
    feature: 'replies',
    maxTokens: 800,
    tools: TOOLS,
    runTool,
    messages: [
      { role: 'system', content: prompt('replies') },
      { role: 'user', content: grounded.facts ? `FACTS\n${JSON.stringify(grounded.facts)}\n\nCUSTOMER MESSAGE\n${text}` : text },
    ],
  });
  const allCalls = [...grounded.calls, ...answer.toolCalls];
  const policy = allCalls.find((call) => call.name === 'check_refund_policy')?.result ?? null;
  return {
    reply: answer.text,
    toolCalls: allCalls.map(({ name, arguments: args }) => ({ name, arguments: args })),
    policy: policy && { eligible: policy.eligible, rule: policy.rule, ...(policy.voucher ? { voucher: policy.voucher } : {}) },
    masked,
    model: answer.model,
    usage: answer.usage,
    latencyMs: answer.latencyMs,
  };
};
