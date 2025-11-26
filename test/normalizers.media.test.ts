import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_IMAGES, normalizeImages } from '../server/normalizers/media.js';

test('normalizeImages filters out non-string values and unwraps scalars', () => {
  assert.deepEqual(normalizeImages('https://example.com/a.jpg'), ['https://example.com/a.jpg']);
  assert.deepEqual(normalizeImages(['https://example.com/a.jpg', null, 42]), ['https://example.com/a.jpg']);
  assert.deepEqual(normalizeImages(undefined), []);
});

test('fallback images remain available as a default set', () => {
  assert.equal(FALLBACK_IMAGES.length > 0, true);
  assert.ok(FALLBACK_IMAGES.every((url) => typeof url === 'string'));
});
