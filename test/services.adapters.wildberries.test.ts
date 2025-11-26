import test from 'node:test';
import assert from 'node:assert/strict';
import { wildberriesAdapter } from '../server/services/adapters/wildberries.js';

const mockWildberriesResponse = (product: Record<string, unknown>) => {
  return new Response(JSON.stringify({ data: { products: [product] } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

test('wildberries adapter normalizes pricing and discount using shared helpers', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = (async () =>
      mockWildberriesResponse({
        id: 987654,
        name: 'Adapter Product',
        salePriceU: '12300',
        priceU: '24600',
        sale: '50',
        pics: 2,
        sizes: [{ name: 'M ' }, { origName: 'L' }, { optionName: 'M' }],
      })) as any;

    const product = await wildberriesAdapter.fetchProduct(
      new URL('https://www.wildberries.ru/catalog/987654/detail.aspx'),
    );

    assert.ok(product);
    assert.equal(product?.price, 123);
    assert.equal(product?.originalPrice, 246);
    assert.equal(product?.discount, 50);
    assert.deepEqual(product?.sizes, ['L', 'M']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('wildberries adapter falls back to provided sale percent when original price is missing', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = (async () =>
      mockWildberriesResponse({
        id: 123456,
        name: 'Sale Only Product',
        salePriceU: 4500,
        sale: '25',
        pics: 1,
        sizes: [{ size: '42' }, { size: '40' }],
      })) as any;

    const product = await wildberriesAdapter.fetchProduct(
      new URL('https://wildberries.ru/catalog/123456/detail.aspx'),
    );

    assert.ok(product);
    assert.equal(product?.price, 45);
    assert.equal(product?.originalPrice, null);
    assert.equal(product?.discount, 25);
    assert.deepEqual(product?.sizes, ['40', '42']);
  } finally {
    global.fetch = originalFetch;
  }
});
