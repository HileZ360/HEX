import test from 'node:test';
import assert from 'node:assert/strict';
import { ozonAdapter } from '../server/services/adapters/ozon.js';
import { ProductFetchError } from '../server/services/productFetchError.js';
import { MemoryLogger } from './utils/memoryLogger.js';

const buildHtml = (state: object) => `
<html>
  <body>
    <script id="state-web" type="application/json">${JSON.stringify(state)}</script>
  </body>
</html>`;

test('parses product data from Ozon SSR state and logs success', async () => {
  const originalFetch = global.fetch;
  const logger = new MemoryLogger();
  const state = {
    ozon: {
      product: {
        productId: 321,
        name: 'Ozon Hoodie',
        price: { price: 1990, priceOriginal: 2490, discountPercent: 20 },
        media: {
          images: ['https://cdn.example.com/hoodie-1.jpg', 'https://cdn.example.com/hoodie-2.jpg'],
        },
        sizes: [{ name: 'S' }, { name: 'M' }, { name: 'L' }],
        recommendedSize: 'M',
      },
    },
  };

  const html = buildHtml(state);

  try {
    global.fetch = (async () =>
      new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })) as any;

    const product = await ozonAdapter.fetchProduct(new URL('https://www.ozon.ru/product/hoodie-321/'), logger);

    assert.ok(product);
    assert.equal(product?.title, 'Ozon Hoodie');
    assert.equal(product?.article, '321');
    assert.equal(product?.price, 1990);
    assert.equal(product?.originalPrice, 2490);
    assert.equal(product?.discount, 20);
    assert.deepEqual(product?.sizes, ['L', 'M', 'S']);
    assert.equal(product?.recommendedSize, 'M');
    assert.ok(product?.images.some((src) => src.includes('hoodie-1.jpg')));
    assert.ok(logger.entries.some((entry) => entry.level === 'info' && entry.message.includes('Parsed Ozon product')));
  } finally {
    global.fetch = originalFetch;
  }
});

test('wraps network errors into ProductFetchError with context', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = (async () => {
      throw new Error('boom');
    }) as any;

    await assert.rejects(
      () => ozonAdapter.fetchProduct(new URL('https://www.ozon.ru/product/123/')),
      (error) => {
        assert.ok(error instanceof ProductFetchError);
        assert.equal((error as ProductFetchError).statusCode, 502);
        assert.match((error as ProductFetchError).message, /Ошибка загрузки товара Ozon/);
        assert.equal((error as ProductFetchError).context?.url, 'https://www.ozon.ru/product/123/');
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('returns null for non-successful responses', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = (async () => new Response('fail', { status: 404 })) as any;
    const result = await ozonAdapter.fetchProduct(new URL('https://www.ozon.ru/product/404/'));
    assert.equal(result, null);
  } finally {
    global.fetch = originalFetch;
  }
});
