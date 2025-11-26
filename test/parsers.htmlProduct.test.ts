import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHtmlProduct } from '../server/parsers/htmlProduct.js';

const buildHtml = (jsonLd?: object, meta?: { price?: string; sku?: string; ogImage?: string }) => `
  <html>
    <head>
      ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
      ${meta?.price ? `<meta property="product:price:amount" content="${meta.price}" />` : ''}
      ${meta?.sku ? `<meta property="product:retailer_item_id" content="${meta.sku}" />` : ''}
      ${meta?.ogImage ? `<meta property="og:image" content="${meta.ogImage}" />` : ''}
      <title>Fallback title</title>
    </head>
  </html>
`;

test('parses product from json-ld and falls back to meta when missing', () => {
  const html = buildHtml(
    {
      '@type': 'Product',
      name: 'Structured tee',
      offers: { price: '1290', priceSpecification: { price: '1590' } },
      isSimilarTo: [{ name: 'Similar tee', image: 'https://example.com/similar.jpg', price: '1090' }],
    },
    { sku: 'ABC-123', ogImage: 'https://example.com/og.jpg' },
  );

  const product = parseHtmlProduct(html, new URL('https://lamoda.ru/p/123/'));
  assert.equal(product.title, 'Structured tee');
  assert.equal(product.article, 'ABC-123');
  assert.equal(product.price, 1290);
  assert.equal(product.originalPrice, 1590);
  assert.ok(product.images.includes('https://example.com/og.jpg'));
  assert.equal(product.similar[0]?.title, 'Similar tee');
});

test('uses fallback values when json-ld is missing or malformed', () => {
  const html = buildHtml(undefined, { price: '990', ogImage: 'https://example.com/default.jpg' });
  const product = parseHtmlProduct(html, new URL('https://ozon.ru/product/999'));

  assert.equal(product.title, 'Fallback title');
  assert.equal(product.article, '999');
  assert.equal(product.price, 990);
  assert.deepEqual(product.sizes, []);
  assert.ok(product.images.includes('https://example.com/default.jpg'));
});
