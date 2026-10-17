import assert from 'node:assert/strict';
import { test } from 'node:test';

import { search } from '../app/lib/kb.mjs';

test('finds the help article a question is about', () => {
  assert.equal(search('How long does a refund take to reach my card?')[0].id, 'kb-returns');
  assert.equal(search('Can I get my money back for a gift card?')[0].id, 'kb-gift-cards');
});

test('finds nothing for a question the help center does not cover', () => {
  assert.deepEqual(search('Do you sell garden furniture in Brazil?'), []);
});
