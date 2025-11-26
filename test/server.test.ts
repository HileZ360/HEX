import test from 'node:test';
import assert from 'node:assert/strict';
import FormData from 'form-data';
import sharp from 'sharp';

process.env.NODE_ENV = 'test';
process.env.TRY_ON_API_URL = 'https://tryon.local/api';
process.env.TRY_ON_PROVIDER_TIMEOUT_MS = '100';

const serverPromise = import('../server/index').then((mod) => mod.default);

const buildTryOnForm = async () => {
  const sourceBuffer = await sharp({
    create: { width: 1400, height: 1400, channels: 3, background: { r: 12, g: 140, b: 240 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const form = new FormData();
  form.append('image', sourceBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });
  form.append('suggestedSize', 'L');

  return { form, sourceBuffer } as const;
};

const buildResponse = (url: string) =>
  serverPromise.then((server) =>
    server.inject({
      method: 'GET',
      url: '/api/product/parse',
      query: { url },
    }),
  );

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
    global.fetch = async () =>
      new Response(null, { status: 302, headers: { location: 'https://example.com/out' } });

    const response = await buildResponse('https://www.lamoda.ru/p/123/');
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /Редирект на неподдерживаемый домен/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('extracts available sizes from structured product data', async () => {
  const originalFetch = global.fetch;
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          ${JSON.stringify({
            '@type': 'Product',
            name: 'Sized tee',
            image: 'https://cdn.example.com/tee.jpg',
            offers: {
              price: '1290',
              size: [{ name: 'S' }, { size: 'M' }, 'L', null],
            },
          })}
        </script>
      </head>
    </html>`;

  try {
    global.fetch = async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });

    const response = await buildResponse('https://www.lamoda.ru/p/567/');
    assert.equal(response.statusCode, 200);

    const payload = response.json();
    assert.deepEqual(payload.sizes, ['L', 'M', 'S']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('returns compressed preview link for 2d try-on without base64 payload', async () => {
  const { form } = await buildTryOnForm();
  const providerPreview = await sharp({
    create: { width: 320, height: 480, channels: 3, background: { r: 30, g: 40, b: 90 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

  const originalFetch = global.fetch;

  try {
    global.fetch = async (_input: any, init: any) => {
      const body = init?.body as FormData;
      const uploadedImage = body?.get('image') as File;
      assert.ok(uploadedImage, 'image should be sent to provider');
      const uploadedBuffer = Buffer.from(await uploadedImage.arrayBuffer());
      assert.ok(uploadedBuffer.byteLength > 0, 'provider receives non-empty upload');

      return new Response(
        JSON.stringify({
          preview: `data:image/jpeg;base64,${providerPreview.toString('base64')}`,
          masks: ['mask-1'],
          recommendedSize: 'L',
          recommendation: 'Сервис подтвердил размер L',
          confidence: 0.94,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

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
    assert.equal(data.recommendedSize, 'L');
    assert.deepEqual(data.masks, ['mask-1']);
    assert.equal(data.recommendation, 'Сервис подтвердил размер L');
    assert.ok(!String(response.payload).includes('base64'));

    const previewResponse = await server.inject({
      method: 'GET',
      url: data.previewUrl,
    });

    assert.equal(previewResponse.statusCode, 200);
    const previewBuffer = Buffer.isBuffer(previewResponse.rawPayload)
      ? (previewResponse.rawPayload as Buffer)
      : Buffer.from(previewResponse.payload as string, 'binary');

    assert.equal(
      previewBuffer.toString('base64'),
      providerPreview.toString('base64'),
      'persisted preview should match provider buffer',
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('returns 504 when try-on provider exceeds timeout', async () => {
  const { form } = await buildTryOnForm();
  const originalFetch = global.fetch;

  try {
    global.fetch = (_input: any, init: any) =>
      new Promise((_, reject) => {
        const signal: AbortSignal | undefined = init?.signal;
        if (signal) {
          const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            reject(new DOMException('Aborted', 'AbortError'));
          };

          signal.addEventListener('abort', onAbort);
        }
      });

    const server = await serverPromise;
    const response = await server.inject({
      method: 'POST',
      url: '/api/tryon/2d',
      payload: form.getBuffer(),
      headers: form.getHeaders(),
    });

    assert.equal(response.statusCode, 504);
    assert.match(response.json().message, /Превышено время ожидания/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('maps provider errors to 502 response', async () => {
  const { form } = await buildTryOnForm();
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      new Response(JSON.stringify({ error: 'Unsupported image' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });

    const server = await serverPromise;
    const response = await server.inject({
      method: 'POST',
      url: '/api/tryon/2d',
      payload: form.getBuffer(),
      headers: form.getHeaders(),
    });

    assert.equal(response.statusCode, 502);
    assert.match(response.json().message, /Unsupported image|Сервис примерки/);
  } finally {
    global.fetch = originalFetch;
  }
});
