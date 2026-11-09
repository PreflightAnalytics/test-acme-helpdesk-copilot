import assert from 'node:assert/strict';
import { test } from 'node:test';

const { euros } = await import('../app/lib/money.mjs');

test('writes a euro amount with two decimals', () => {
  assert.equal(euros(10), '€10.00');
  assert.equal(euros('49.5'), '€49.50');
});
