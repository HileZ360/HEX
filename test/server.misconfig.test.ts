import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
delete process.env.TRY_ON_API_URL;
delete process.env.TRY_ON_API_TOKEN;
delete process.env.TRY_ON_3D_API_URL;

const serverPromise = import('../server/index').then((mod) => mod.default);

const valid3DBody = {
  gender: 'male' as const,
  height: 180,
  weight: 80,
  chest: 100,
  waist: 90,
  hips: 100,
};

test('returns informative error when try-on provider env is missing', async () => {
  const server = await serverPromise;

  const response = await server.inject({
    method: 'POST',
    url: '/api/tryon/3d',
    payload: valid3DBody,
  });

  assert.equal(response.statusCode, 500);
  assert.match(response.json().message, /3D-примерки не настроен/);
});
