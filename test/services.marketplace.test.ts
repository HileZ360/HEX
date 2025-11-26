import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRedirects, isAllowedMarketplace, ProductFetchError } from '../server/services/marketplace.js';
import { MemoryLogger } from './utils/memoryLogger.js';

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

test('fetchWithRedirects logs redirect chain and final URL', async () => {
  const originalFetch = global.fetch;
  const logger = new MemoryLogger();

  try {
    let call = 0;
    global.fetch = (async (input: any) => {
      call += 1;
      if (call === 1) {
        return new Response(null, { status: 302, headers: { location: '/next' } });
      }

      return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    }) as any;

    const result = await fetchWithRedirects({
      url: new URL('https://ozon.ru/p/1'),
      signal: new AbortController().signal,
      logger,
    });

    assert.equal(result.finalUrl.href, 'https://ozon.ru/next');
    assert.ok(
      logger.entries.some(
        (entry) => entry.level === 'debug' && String(entry.meta ?? entry.message).includes('Following redirect'),
      ),
      'redirects should be logged',
    );
    assert.ok(
      logger.entries.some(
        (entry) => entry.level === 'info' && String(entry.meta ?? entry.message).includes('Fetched product page'),
      ),
      'final fetch should be logged',
    );
  } finally {
    global.fetch = originalFetch;
  }
});
