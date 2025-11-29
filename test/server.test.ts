import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import sharp from 'sharp';

process.env.NODE_ENV = 'test';
process.env.TRY_ON_API_URL = 'https://tryon.local/api';
process.env.TRY_ON_3D_API_URL = 'https://tryon.local/api/3d';
process.env.TRY_ON_PROVIDER_TIMEOUT_MS = '100';

const serverModulePromise = import('../server/index');
const serverPromise = serverModulePromise.then((mod) => mod.default);

const buildTryOnForm = async ({
  garmentImageUrl,
  productId,
}: { garmentImageUrl?: string | null; productId?: string } = {}) => {
  const sourceBuffer = await sharp({
    create: { width: 1400, height: 1400, channels: 3, background: { r: 12, g: 140, b: 240 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const form = new FormData();
  form.append('image', sourceBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });
  form.append('suggestedSize', 'L');
  const finalGarmentImageUrl = garmentImageUrl === undefined ? 'https://cdn.example.com/garment.jpg' : garmentImageUrl;
  if (typeof finalGarmentImageUrl === 'string') {
    form.append('garmentImageUrl', finalGarmentImageUrl);
  }
  if (productId) {
    form.append('productId', productId);
  }

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
      const body = JSON.parse(String(init?.body));
      assert.match(body.cloth_image_url, /garment\.jpg$/, 'garment image should be forwarded');
      const uploadedBuffer = Buffer.from(String(body.input_image).replace(/^data:[^,]+,/, ''), 'base64');
      assert.ok(uploadedBuffer.byteLength > 0, 'provider receives non-empty upload');

      return new Response(
        JSON.stringify({
          render: `data:image/jpeg;base64,${providerPreview.toString('base64')}`,
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

test('maintains manifest integrity when previews persist concurrently', async () => {
  const helpers = (await serverModulePromise).__previewTestHelpers;
  assert.ok(helpers, 'preview helpers should be available in test mode');

  await helpers.resetPreviewStorageForTest();

  const controllerA = new AbortController();
  const controllerB = new AbortController();
  const bufferA = Buffer.from('concurrent-preview-a');
  const bufferB = Buffer.from('concurrent-preview-b');

  const [first, second] = await Promise.all([
    helpers.persistPreviewForTest({ buffer: bufferA, signal: controllerA.signal }),
    helpers.persistPreviewForTest({ buffer: bufferB, signal: controllerB.signal }),
  ]);

  const manifest = await helpers.readPreviewManifestForTest();
  assert.equal(manifest.items.length, 2, 'both previews should be recorded');

  const filenames = manifest.items.map((item) => item.filename);
  assert.equal(new Set(filenames).size, 2, 'filenames must stay unique');

  const { previewDir } = helpers;
  assert.ok(previewDir, 'preview directory should be available');

  const sizes = await Promise.all(
    manifest.items.map((item) => fs.stat(path.join(previewDir!, item.filename)).then((stat) => stat.size)),
  );
  const expectedSizes = [bufferA.length, bufferB.length].sort((a, b) => a - b);

  assert.ok(filenames.includes(first.filename));
  assert.ok(filenames.includes(second.filename));
  assert.deepEqual([...sizes].sort((a, b) => a - b), expectedSizes);
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

test('uses cached product image when only productId is provided', async () => {
  const originalFetch = global.fetch;
  const productImage = 'https://cdn.example.com/from-parse.jpg';
  const providerPreview = Buffer.from('provider-render');
  let providerCalls = 0;

  try {
    global.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : String(input);

      if (url.includes('card.wb.ru')) {
        return new Response(
          JSON.stringify({ data: { products: [{ id: 123, salePriceU: 10000, priceU: 12000, pics: 1 }] } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.includes('wildberries.ru')) {
        const html = `
          <html>
            <head>
              <script type="application/ld+json">
                ${JSON.stringify({ '@type': 'Product', name: 'Test item', image: productImage })}
              </script>
            </head>
          </html>`;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
      }

      if (url.includes('tryon.local')) {
        providerCalls += 1;
        return new Response(
          JSON.stringify({ render: `data:image/jpeg;base64,${providerPreview.toString('base64')}` }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return Response.error();
    };

    const server = await serverPromise;
    const parseResponse = await server.inject({
      method: 'GET',
      url: '/api/product/parse',
      query: { url: 'https://wildberries.ru/catalog/123/detail.aspx' },
    });

    const parsed = parseResponse.json();
    const { productId } = parsed;
    assert.ok(productId, 'parse response should include productId');

    const { form } = await buildTryOnForm({ garmentImageUrl: null, productId });
    const tryOnResponse = await server.inject({
      method: 'POST',
      url: '/api/tryon/2d',
      payload: form.getBuffer(),
      headers: form.getHeaders(),
    });

    assert.equal(tryOnResponse.statusCode, 200);
    assert.equal(providerCalls, 1);
    assert.ok(/preview/.test(tryOnResponse.json().previewUrl));
  } finally {
    global.fetch = originalFetch;
  }
});

test('rejects try-on without garment reference', async () => {
  const { form } = await buildTryOnForm({ garmentImageUrl: null });
  const server = await serverPromise;

  const response = await server.inject({
    method: 'POST',
    url: '/api/tryon/2d',
    payload: form.getBuffer(),
    headers: form.getHeaders(),
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /ссылк|одежд/i);
});

test('rejects try-on with invalid garment url', async () => {
  const { form } = await buildTryOnForm({ garmentImageUrl: 'ftp://invalid/image.png' });
  const server = await serverPromise;

  const response = await server.inject({
    method: 'POST',
    url: '/api/tryon/2d',
    payload: form.getBuffer(),
    headers: form.getHeaders(),
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /HTTPS|корректн/i);
});

test('sends body params to 3d provider and returns persisted render', async () => {
  const originalFetch = global.fetch;
  const renderBuffer = Buffer.from('3d-render');
  let receivedPayload: any = null;

  try {
    global.fetch = async (_input: any, init: any) => {
      receivedPayload = JSON.parse(init?.body);
      return new Response(
        JSON.stringify({
          render: `data:image/png;base64,${renderBuffer.toString('base64')}`,
          recommendedSize: 'XL',
          fitMetrics: [{ label: 'По груди', status: 'Комфортно', score: 90, detail: 'Тест' }],
          confidence: 0.91,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const server = await serverPromise;
    const response = await server.inject({
      method: 'POST',
      url: '/api/tryon/3d',
      payload: {
        gender: 'female',
        height: 168,
        weight: 60,
        chest: 88,
        waist: 68,
        hips: 94,
        suggestedSize: 'M',
      },
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(receivedPayload, {
      gender: 'female',
      height: 168,
      weight: 60,
      chest: 88,
      waist: 68,
      hips: 94,
      suggestedSize: 'M',
    });

    const data = response.json();
    assert.equal(data.recommendedSize, 'XL');
    assert.equal(data.fitMetrics[0].label, 'По груди');
    assert.ok(/^\/api\/tryon\/2d\/preview\//.test(data.renderedImage));
    assert.ok(!String(response.payload).includes('unsplash'));

    const previewResponse = await server.inject({ method: 'GET', url: data.renderedImage });
    const previewBuffer = Buffer.isBuffer(previewResponse.rawPayload)
      ? (previewResponse.rawPayload as Buffer)
      : Buffer.from(previewResponse.payload as string, 'binary');

    assert.equal(previewBuffer.toString('base64'), renderBuffer.toString('base64'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('returns validation errors for invalid 3d payload', async () => {
  const server = await serverPromise;
  const response = await server.inject({
    method: 'POST',
    url: '/api/tryon/3d',
    payload: { gender: 'unknown', height: 100, weight: 20 },
    headers: { 'content-type': 'application/json' },
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json();
  assert.ok(payload.errors.gender);
  assert.ok(payload.errors.chest);
  assert.match(payload.message, /Проверьте корректность/);
});

test('returns 504 when 3d provider exceeds timeout', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = (_input: any, init: any) =>
      new Promise((_, reject) => {
        const signal: AbortSignal | undefined = init?.signal;
        if (signal) {
          const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            const error: any = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          };

          signal.addEventListener('abort', onAbort);
        }
      });

    const server = await serverPromise;
    const response = await server.inject({
      method: 'POST',
      url: '/api/tryon/3d',
      payload: { gender: 'male', height: 180, weight: 80, chest: 100, waist: 85, hips: 100 },
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(response.statusCode, 504);
    assert.match(response.json().message, /Превышено время ожидания/);
  } finally {
    global.fetch = originalFetch;
  }
});
