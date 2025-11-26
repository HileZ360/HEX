import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSimilarItems } from '../server/normalizers/similar.js';

const buildSimilar = () => [
  { name: ' First tee ', image: ['https://example.com/a.jpg', 'https://example.com/unused.jpg'], price: '1090' },
  { title: 'First tee', image: 'https://example.com/a.jpg', price: 'ignore-duplicate' },
  { name: 'Second tee', offers: { price: '2090' }, image: '   ' },
  { price: '3000' },
  'not-an-object',
  null,
  { title: 'Third tee' },
];

test('normalizeSimilarItems validates fields, deduplicates, and preserves order', () => {
  const normalized = normalizeSimilarItems(buildSimilar());

  assert.deepEqual(normalized, [
    { title: 'First tee', price: 1090, image: 'https://example.com/a.jpg' },
    { title: 'Second tee', price: 2090, image: undefined },
    { title: 'Third tee', price: undefined, image: undefined },
  ]);
});

