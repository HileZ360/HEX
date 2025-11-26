import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductFromUrl } from '../server/productParser.js';
import { ProductFetchError } from '../server/services/marketplace.js';
import { MemoryLogger } from './utils/memoryLogger.js';

const buildHtml = (name: string) => `
<html>
  <head>
    <script type="application/ld+json">
      ${JSON.stringify({
        '@type': 'Product',
        name,
        image: 'https://cdn.example.com/item.jpg',
        offers: { price: '1990' },
      })}
    </script>
  </head>
</html>`;

test('falls back to HTML parser when Wildberries API is empty and logs the fallback', async () => {
  const originalFetch = global.fetch;
  const logger = new MemoryLogger();
  const html = buildHtml('Fallback tee');

  try {
    let call = 0;
    global.fetch = (async (input: any) => {
      call += 1;
      if (call === 1) {
        return new Response(null, { status: 404 });
      }

      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    }) as any;

    const product = await parseProductFromUrl('https://www.wildberries.ru/catalog/123/detail.aspx', logger);
    assert.equal(product.title, 'Fallback tee');

    const fallbackLog = logger.entries.find((entry) => entry.level === 'warn');
    assert.ok(fallbackLog);
    assert.match(fallbackLog?.message ?? '', /Falling back to HTML parser/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('exposes safe error message and status while retaining technical context', async () => {
  const originalFetch = global.fetch;
  const logger = new MemoryLogger();

  try {
    global.fetch = (async () => new Response(null, { status: 500 })) as any;

    await assert.rejects(
      () => parseProductFromUrl('https://www.ozon.ru/p/42', logger),
      (error) => {
        assert.ok(error instanceof ProductFetchError);
        assert.equal(error.statusCode, 502);
        assert.match(error.message, /Не удалось загрузить страницу товара: 500/);
        assert.deepEqual((error as ProductFetchError).context?.redirectChain, [
          'https://www.ozon.ru/p/42',
        ]);

        assert.ok(
          logger.entries.some((entry) => entry.level === 'info' && entry.message.includes('Fetched product page')) ===
            false,
          'no success logs should be recorded for failing fetch',
        );
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});
