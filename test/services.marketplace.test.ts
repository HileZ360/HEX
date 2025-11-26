import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRedirects, isAllowedMarketplace, ProductFetchError } from '../server/services/marketplace.js';

test('isAllowedMarketplace validates subdomains and root domains', () => {
  assert.equal(isAllowedMarketplace('ozon.ru'), true);
  assert.equal(isAllowedMarketplace('shop.ozon.ru'), true);
  assert.equal(isAllowedMarketplace('example.com'), false);
});

test('fetchWithRedirects throws on unsupported redirects', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = (async () =>
      new Response(null, { status: 302, headers: { location: 'https://example.com/out' } })) as any;

    await assert.rejects(fetchWithRedirects({ url: new URL('https://ozon.ru/p/1'), signal: new AbortController().signal }), (error) => {
      assert.ok(error instanceof ProductFetchError);
      assert.equal((error as ProductFetchError).statusCode, 400);
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});
