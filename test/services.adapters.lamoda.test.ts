import test from 'node:test';
import assert from 'node:assert/strict';
import { lamodaAdapter } from '../server/services/adapters/lamoda.js';
import { MemoryLogger } from './utils/memoryLogger.js';

const buildLamodaHtml = () => `
<html>
  <head>
    <title>Lamoda Jacket</title>
    <meta property="og:title" content="Lamoda Jacket" />
    <meta property="product:price:amount" content="4999" />
    <meta itemprop="sku" content="LM-123" />
    <meta property="og:image" content="https://cdn.lamoda.example/img/main.jpg" />
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "Product",
        "name": "Lamoda Jacket",
        "sku": "LM-123",
        "image": [
          "https://cdn.lamoda.example/img/1.jpg",
          "https://cdn.lamoda.example/img/2.jpg"
        ],
        "offers": {
          "@type": "Offer",
          "price": "4999",
          "priceSpecification": { "price": "5999" }
        }
      }
    </script>
  </head>
  <body>
    <div class="sizes">
      <button data-size-name="S">S</button>
      <button data-size-name="M">M</button>
      <button data-size-name="L">L</button>
    </div>
  </body>
</html>
`;

test('parses Lamoda product HTML with json-ld and size buttons', async () => {
  const originalFetch = global.fetch;
  const logger = new MemoryLogger();

  try {
    global.fetch = (async () =>
      new Response(buildLamodaHtml(), { status: 200, headers: { 'content-type': 'text/html' } })) as any;

    const product = await lamodaAdapter.fetchProduct(new URL('https://www.lamoda.ru/p/lm-123/'), logger);

    assert.ok(product);
    assert.equal(product?.title, 'Lamoda Jacket');
    assert.equal(product?.article, 'LM-123');
    assert.equal(product?.price, 4999);
    assert.equal(product?.originalPrice, 5999);
    assert.equal(product?.discount, 17);
    assert.deepEqual(product?.sizes, ['L', 'M', 'S']);
    assert.ok(product?.images.some((src) => src.includes('/1.jpg')));

    const infoEntry = logger.entries.find((entry) => entry.level === 'info');
    assert.ok(infoEntry);
    const infoMessage =
      typeof infoEntry.message === 'string' ? infoEntry.message : JSON.stringify(infoEntry.message ?? {});
    assert.ok(infoMessage.includes('Lamoda'));
  } finally {
    global.fetch = originalFetch;
  }
});
