import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSizes, normalizeSizeValue } from '../server/normalizers/sizing.js';

test('normalizeSizeValue handles objects, numbers, and trimmed strings', () => {
  assert.equal(normalizeSizeValue({ name: ' XL ' }), 'XL');
  assert.equal(normalizeSizeValue({ title: 42 }), '42');
  assert.equal(normalizeSizeValue(' M '), 'M');
  assert.equal(normalizeSizeValue(null), undefined);
});

test('extractSizes deduplicates, sorts, and ignores empty values', () => {
  const product = {
    offers: [
      { size: ['M', 'M', ' '] },
      { size: { size: ['S', 'L'] } },
      { size: { label: 'XL' } },
    ],
    sizes: [2, '10', '2'],
    size: '',
  };

  assert.deepEqual(extractSizes(product), ['2', '10', 'L', 'M', 'S', 'XL']);
});

test('extractSizes handles nested size arrays and unsupported shapes', () => {
  const product = {
    offers: [
      { size: { size: ['XS', ['S', { name: 'M' }]] } },
      { size: { dimensions: { chest: 10 } } },
    ],
    sizes: { size: [{ title: 'L' }, { value: 'XL' }] },
  };

  assert.deepEqual(extractSizes(product), ['L', 'M', 'S', 'XL', 'XS']);
});

test('extractSizes returns empty array when nothing can be normalized', () => {
  const product = {
    offers: [{ size: { dimensions: { chest: 100 } } }],
    size: undefined,
  };

  assert.deepEqual(extractSizes(product), []);
});
