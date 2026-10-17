import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.ACME_CLOCK = '2026-10-17T12:00:00Z';
const { checkRefundPolicy, lookupOrder } = await import('../app/lib/orders.mjs');

test('looks an order up without leaking the customer’s email', () => {
  const order = lookupOrder('#2210');
  assert.equal(order.found, true);
  assert.equal(order.customer.firstName, 'Tom');
  assert.equal(JSON.stringify(order).includes('@'), false);
  assert.equal(lookupOrder('9999').found, false);
});

test('applies the refund policy rule by rule', () => {
  assert.deepEqual([checkRefundPolicy('2210', 'damaged').eligible, checkRefundPolicy('2210', 'damaged').rule], [true, 2]);
  assert.equal(checkRefundPolicy('4412').eligible, false);
  assert.equal(checkRefundPolicy('4412').rule, 5);
  assert.equal(checkRefundPolicy('5120').rule, 5);
  assert.equal(checkRefundPolicy('6031').eligible, false);
  assert.equal(checkRefundPolicy('3307', 'late').voucher.amount, 10);
  assert.equal(checkRefundPolicy('7788', 'lost').eligible, true);
});
