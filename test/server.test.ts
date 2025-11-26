import test from 'node:test';
import assert from 'node:assert/strict';
import FormData from 'form-data';
import sharp from 'sharp';

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

test('follows safe https redirect within the same marketplace domain', async () => {
  const originalFetch = global.fetch;
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          ${JSON.stringify({
            '@type': 'Product',
            name: 'Redirected tee',
            image: 'https://cdn.example.com/tee.jpg',
            offers: { price: '1490' },
          })}
        </script>
      </head>
    </html>`;

  try {
    let call = 0;
    global.fetch = async (input: any) => {
      call += 1;
      if (call === 1) {
        return new Response(null, { status: 301, headers: { location: '/product/final' } });
      }
      assert.equal(new URL(input).pathname, '/product/final');
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    };

    const response = await buildResponse('https://www.ozon.ru/product/start');
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.title, 'Redirected tee');
    assert.ok(call >= 2, 'should follow redirect to final url');
  } finally {
    global.fetch = originalFetch;
  }
});

test('rejects redirects to unsupported marketplace domains', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://example.com/out' } });

    const response = await buildResponse('https://www.lamoda.ru/p/123/');
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /Редирект на неподдерживаемый домен/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('returns compressed preview link for 2d try-on without base64 payload', async () => {
  const sourceBuffer = await sharp({
    create: { width: 1400, height: 1400, channels: 3, background: { r: 12, g: 140, b: 240 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const form = new FormData();
  form.append('image', sourceBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });
  form.append('suggestedSize', 'L');

  const server = await serverPromise;
  const response = await server.inject({
    method: 'POST',
    url: '/api/tryon/2d',
    payload: form.getBuffer(),
    headers: form.getHeaders(),
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.payload.length < 2000, 'payload should stay compact and avoid base64 previews');

  const data = response.json();
  assert.match(data.previewUrl, /^\/api\/tryon\/2d\/preview\//);
  assert.ok(!String(response.payload).includes('base64'));

  const previewResponse = await server.inject({
    method: 'GET',
    url: data.previewUrl,
  });

  assert.equal(previewResponse.statusCode, 200);
  const previewBuffer = Buffer.isBuffer(previewResponse.rawPayload)
    ? (previewResponse.rawPayload as Buffer)
    : Buffer.from(previewResponse.payload as string, 'binary');

  assert.ok(previewBuffer.byteLength < sourceBuffer.byteLength, 'resized preview should weigh less than source');
});
