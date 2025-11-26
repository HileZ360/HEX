import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { extractJsonLdProduct, findProductObject, safeJsonParse } from '../server/parsers/jsonld.js';

test('safeJsonParse returns null on malformed payloads', () => {
  assert.equal(safeJsonParse('{bad json'), null);
  assert.deepEqual(safeJsonParse('{"name":"ok"}'), { name: 'ok' });
});

test('findProductObject walks nested arrays to find product type', () => {
  const data = { '@type': 'Thing', children: [{ '@type': 'Product', name: 'Nested' }] };
  assert.equal(findProductObject(data)?.name, 'Nested');
});

test('extractJsonLdProduct skips invalid script content', () => {
  const html = `
    <script type="application/ld+json">{ bad json }</script>
    <script type="application/ld+json">{"@type":"Product","name":"Valid"}</script>
  `;
  const $ = load(html);
  assert.equal(extractJsonLdProduct($)?.name, 'Valid');
});
