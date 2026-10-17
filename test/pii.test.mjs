import assert from 'node:assert/strict';
import { test } from 'node:test';

import { maskPii } from '../app/lib/pii.mjs';

test('masks emails, phones, cards and IBANs but keeps order numbers', () => {
  const { text, masked } = maskPii('Order 2210. Mail tom.hartley@example.co.uk, call +44 20 7946 0958, card 4111 1111 1111 1111, IBAN PT50 0002 0123 1234 5678 9015 4.');
  assert.match(text, /Order 2210\./);
  assert.doesNotMatch(text, /tom\.hartley|7946|4111|PT50/);
  assert.deepEqual(masked, ['card', 'email', 'iban', 'phone']);
});

test('leaves a ticket without personal data alone', () => {
  assert.deepEqual(maskPii('My lamp from order 3307 is late.'), { text: 'My lamp from order 3307 is late.', masked: [] });
});
