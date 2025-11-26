import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSizes, normalizeSizeValue } from '../server/normalizers/sizing.js';

test('normalizeSizeValue handles objects, numbers, and trimmed strings', () => {
  assert.equal(normalizeSizeValue({ name: ' XL ' }), 'XL');
  assert.equal(normalizeSizeValue({ title: 42 }), '42');
  assert.equal(normalizeSizeValue(' M '), 'M');
  assert.equal(normalizeSizeValue(null), undefined);
});

test('extractSizes collects sizes from offers and top-level fields', () => {
  const product = {
    offers: [{ size: { size: ['S', 'M'] } }, { sizes: ['L', null] }],
    size: 'XL',
  };

  assert.deepEqual(extractSizes(product), ['S', 'M', 'L', 'XL']);
});
