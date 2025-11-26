import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const serverPromise = import('../server/index').then((mod) => mod.default);

const buildResponse = (url: string) => serverPromise.then((server) => server.inject({
  method: 'GET',
  url: '/api/product/parse',
  query: { url },
}));

test('rejects unsupported domain', async () => {
  const response = await buildResponse('https://example.com/product/123');
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /Неподдерживаемый источник товара/);
});

test('rejects non-https protocol even on allowed domain', async () => {
  const response = await buildResponse('http://wildberries.ru/catalog/123');
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /Неподдерживаемый источник товара/);
});

test('rejects invalid url string', async () => {
  const response = await buildResponse('not-a-valid-url');
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'Invalid url query param');
});
