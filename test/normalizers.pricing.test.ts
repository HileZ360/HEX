import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDiscount, ensureNumber, extractPriceFromOffers } from '../server/normalizers/pricing.js';

test('ensureNumber handles numeric-like strings and ignores noise', () => {
  assert.equal(ensureNumber('1 299 ₽'), 1299);
  assert.equal(ensureNumber('invalid'), undefined);
  assert.equal(ensureNumber(99.5), 99.5);
});

test('computeDiscount returns undefined when data is incomplete', () => {
  assert.equal(computeDiscount(undefined, 2000), undefined);
  assert.equal(computeDiscount(1000, undefined), undefined);
  assert.equal(computeDiscount(1000, 0), undefined);
  assert.equal(computeDiscount(1000, 2000), 50);
});

test('extractPriceFromOffers scans arrays and returns undefined when absent', () => {
  assert.deepEqual(extractPriceFromOffers(null), { price: undefined, originalPrice: undefined });
  assert.deepEqual(extractPriceFromOffers({ priceCurrency: '1999' }), { price: 1999, originalPrice: undefined });
  assert.deepEqual(
    extractPriceFromOffers([{ priceSpecification: { price: '2490' } }, { listPrice: '2990' }]),
    { price: 2490, originalPrice: undefined },
  );
});
