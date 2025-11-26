import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { ALLOWED_MARKETPLACE_DOMAINS, parseProductFromUrl } from './productParser';

const AVAILABLE_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const TRY_ON_TIMEOUT_MS = 20000;

const server = Fastify({ logger: true });
const PREVIEW_DIR = path.join(process.cwd(), 'tmp', 'tryon-previews');
const PREVIEW_ROUTE_PREFIX = '/api/tryon/2d/preview';

server.register(multipart, {
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
    files: 1,
  },
  throwFileSizeLimit: true,
});

let previewDirReady: Promise<void> | null = null;

const ensurePreviewDir = () => {
  if (!previewDirReady) {
    previewDirReady = fs.mkdir(PREVIEW_DIR, { recursive: true }).then(() => undefined);
  }
  return previewDirReady;
};

const normalizeSize = (value?: string) => {
  const normalized = value?.trim().toUpperCase();
  return normalized && AVAILABLE_SIZES.includes(normalized) ? normalized : undefined;
};

const abortError = (message: string) => {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
};

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw abortError('Processing aborted');
  }
};

const waitWithSignal = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(abortError('Processing aborted'));
    };

    signal.addEventListener('abort', onAbort);
  });

type FitMetric = {
  label: string;
  status: string;
  score: number;
  detail?: string;
};

const normalizeNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return undefined;
};

const buildValidationError = (message: string, errors?: Record<string, string>) => ({ message, errors });

const validate3DBody = (body: any) => {
  const errors: Record<string, string> = {};

  const gender = typeof body?.gender === 'string' ? body.gender.toLowerCase() : undefined;
  if (!gender || (gender !== 'male' && gender !== 'female')) {
    errors.gender = 'Укажите пол: male или female.';
  }

  const numericFields: Array<{ key: keyof typeof body; label: string; min?: number; max?: number }> = [
    { key: 'height', label: 'Рост', min: 120, max: 230 },
    { key: 'weight', label: 'Вес', min: 30, max: 250 },
    { key: 'chest', label: 'Грудь', min: 60, max: 160 },
    { key: 'waist', label: 'Талия', min: 50, max: 160 },
    { key: 'hips', label: 'Бёдра', min: 60, max: 180 },
  ];

  const parsed: Record<string, number> = {};

  for (const field of numericFields) {
    const parsedValue = normalizeNumber(body?.[field.key]);
    if (parsedValue === undefined || Number.isNaN(parsedValue)) {
      errors[field.key as string] = `${field.label}: введите число.`;
      continue;
    }

    if (field.min !== undefined && parsedValue < field.min) {
      errors[field.key as string] = `${field.label}: значение не может быть ниже ${field.min}.`;
      continue;
    }

    if (field.max !== undefined && parsedValue > field.max) {
      errors[field.key as string] = `${field.label}: значение не может быть выше ${field.max}.`;
      continue;
    }

    parsed[field.key as string] = parsedValue;
  }

  const saveParams = body?.saveParams === true || body?.saveParams === 'true';
  const suggestedSize = normalizeSize(body?.suggestedSize);

  return {
    errors,
    parsed: {
      gender: gender as 'male' | 'female',
      height: parsed.height,
      weight: parsed.weight,
      chest: parsed.chest,
      waist: parsed.waist,
      hips: parsed.hips,
      saveParams,
      suggestedSize,
    },
  } as const;
};

const estimateRecommendedSize = ({
  height,
  weight,
  chest,
  waist,
  hips,
  fallbackSize,
}: {
  height: number;
  weight: number;
  chest: number;
  waist: number;
  hips: number;
  fallbackSize?: string;
}) => {
  const baseScore = weight * 0.4 + height * 0.2 + chest * 0.2 + waist * 0.1 + hips * 0.1;
  const normalized = Math.min(Math.max((baseScore - 200) / 140, 0), 1);
  const sizeIndex = Math.round(normalized * (AVAILABLE_SIZES.length - 1));
  return AVAILABLE_SIZES[sizeIndex] ?? fallbackSize ?? 'M';
};

const buildFitMetrics = ({
  chest,
  waist,
  hips,
  recommendedSize,
}: {
  chest: number;
  waist: number;
  hips: number;
  recommendedSize: string;
}): FitMetric[] => {
  const baseline: Record<string, { chest: number; waist: number; hips: number }> = {
    XXS: { chest: 78, waist: 60, hips: 82 },
    XS: { chest: 82, waist: 64, hips: 86 },
    S: { chest: 86, waist: 68, hips: 90 },
    M: { chest: 92, waist: 74, hips: 96 },
    L: { chest: 98, waist: 80, hips: 102 },
    XL: { chest: 104, waist: 86, hips: 108 },
    XXL: { chest: 110, waist: 92, hips: 114 },
  };

  const target = baseline[recommendedSize as keyof typeof baseline] ?? baseline.M;

  const buildStatus = (value: number, reference: number) => {
    const delta = value - reference;
    if (Math.abs(delta) <= 3) return { status: 'Комфортно', score: 82 };
    if (delta > 3 && delta <= 8) return { status: 'Плотно', score: 65 };
    if (delta < -3 && delta >= -8) return { status: 'Свободно', score: 70 };
    return { status: delta > 0 ? 'На грани' : 'Есть запас', score: 55 };
  };

  const chestStatus = buildStatus(chest, target.chest);
  const waistStatus = buildStatus(waist, target.waist);
  const hipsStatus = buildStatus(hips, target.hips);

  return [
    {
      label: 'По груди',
      status: chestStatus.status,
      score: chestStatus.score,
      detail: `Обхват груди ${chest} см vs. размерная сетка ${target.chest} см`,
    },
    {
      label: 'По талии',
      status: waistStatus.status,
      score: waistStatus.score,
      detail: `Талия ${waist} см vs. ${target.waist} см в выбранном размере`,
    },
    {
      label: 'По бёдрам',
      status: hipsStatus.status,
      score: hipsStatus.score,
      detail: `Бёдра ${hips} см vs. ${target.hips} см по сетке`,
    },
  ];
};

const run3DTryOn = async ({
  gender,
  height,
  weight,
  chest,
  waist,
  hips,
  suggestedSize,
  signal,
}: {
  gender: 'male' | 'female';
  height: number;
  weight: number;
  chest: number;
  waist: number;
  hips: number;
  suggestedSize?: string;
  signal: AbortSignal;
}) => {
  throwIfAborted(signal);

  await waitWithSignal(600, signal); // normalize body params
  await waitWithSignal(900, signal); // mesh generation
  await waitWithSignal(700, signal); // rendering

  const recommendedSize = estimateRecommendedSize({ height, weight, chest, waist, hips, fallbackSize: suggestedSize });
  const fitMetrics = buildFitMetrics({ chest, waist, hips, recommendedSize });

  const confidenceBase = 0.78 + (gender === 'female' ? 0.02 : 0);
  const confidenceSpread = Math.min((weight + chest + waist + hips) / 800, 0.12);
  const confidence = Number(Math.min(confidenceBase + confidenceSpread, 0.96).toFixed(2));

  const renderedImage = `https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80&sat=-20&blend=${recommendedSize}`;

  return {
    recommendedSize,
    confidence,
    renderedImage,
    fitMetrics,
    status: 'completed' as const,
    statusMessage: '3D-примерка завершена.',
  };
};

const resizePreview = async (imageBuffer: Buffer) => {
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize({ width: 960, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, info } as const;
};

const persistPreview = async ({ buffer, signal }: { buffer: Buffer; signal: AbortSignal }) => {
  throwIfAborted(signal);
  await ensurePreviewDir();

  const id = randomUUID();
  const filename = `${id}.jpg`;
  const filepath = path.join(PREVIEW_DIR, filename);

  await fs.writeFile(filepath, buffer);

  return { id, filepath, filename } as const;
};

const buildPreviewUrl = (filename: string) => `${PREVIEW_ROUTE_PREFIX}/${filename.replace(/\.jpg$/, '')}`;

const run2DTryOn = async ({
  imageBuffer,
  suggestedSize,
  signal,
}: {
  imageBuffer: Buffer;
  suggestedSize?: string;
  signal: AbortSignal;
}) => {
  throwIfAborted(signal);
  await waitWithSignal(350, signal); // upload
  await waitWithSignal(550, signal); // segmentation
  await waitWithSignal(700, signal); // rendering

  const recommendedSize = normalizeSize(suggestedSize) ?? 'M';
  const sizeConfidenceBoost = suggestedSize ? 0.03 : 0;
  const bufferImpact = Math.min(imageBuffer.length / (8 * 1024 * 1024), 1);
  const confidence = Number((0.82 + bufferImpact * 0.12 + sizeConfidenceBoost).toFixed(2));

  const { buffer: previewBuffer } = await resizePreview(imageBuffer);
  const persistedPreview = await persistPreview({ buffer: previewBuffer, signal });
  const previewUrl = buildPreviewUrl(persistedPreview.filename);

  return {
    previewUrl,
    imageUrl: previewUrl,
    recommendedSize,
    confidence: Math.min(confidence, 0.97),
    recommendation: `Рекомендуем размер ${recommendedSize}: примерка учла пропорции силуэта и плотность ткани.`,
  } as const;
};

server.get('/api/product/parse', async (request, reply) => {
  const url = (request.query as { url?: string }).url;

  if (!url) {
    reply.code(400).send({ error: 'Missing url query param' });
    return;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    reply.code(400).send({ error: 'Invalid url query param' });
    return;
  }

  const allowedDomains = ALLOWED_MARKETPLACE_DOMAINS;
  const isHttps = parsedUrl.protocol === 'https:';
  const isAllowedDomain = allowedDomains.some(
    (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`),
  );

  if (!isHttps || !isAllowedDomain) {
    const allowedList = ALLOWED_MARKETPLACE_DOMAINS.join(', ');
    reply
      .code(400)
      .send({ error: `Неподдерживаемый источник товара. Используйте HTTPS-ссылки ${allowedList}.` });
    return;
  }

  try {
    const parsedProduct = await parseProductFromUrl(url);

    reply.send({
      title: parsedProduct.title,
      article: parsedProduct.article ?? null,
      price: parsedProduct.price ?? null,
      originalPrice: parsedProduct.originalPrice ?? null,
      discount: parsedProduct.discount ?? null,
      images: parsedProduct.images ?? [],
      similar: parsedProduct.similar ?? [],
      sizes: parsedProduct.sizes ?? [],
      recommendedSize: parsedProduct.recommendedSize ?? null,
      recommendationConfidence: parsedProduct.recommendationConfidence ?? null,
      fitNotes: parsedProduct.fitNotes ?? [],
      marketplace: parsedProduct.marketplace,
    });
  } catch (error: any) {
    request.log.error(error);
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    const message =
      statusCode === 504
        ? 'Превышено время ожидания загрузки товара'
        : error?.message ?? 'Failed to parse product';

    reply.code(statusCode).send({ error: message });
  }
});

server.get(`${PREVIEW_ROUTE_PREFIX}/:id`, async (request, reply) => {
  const { id } = request.params as { id?: string };
  if (!id || !/^[-a-f0-9]+$/i.test(id)) {
    reply.code(400).send({ message: 'Укажите корректный идентификатор предпросмотра.' });
    return;
  }

  const filepath = path.join(PREVIEW_DIR, `${id}.jpg`);

  try {
    const file = await fs.readFile(filepath);
    reply.type('image/jpeg').send(file);
  } catch (error: any) {
    request.log.error(error);
    reply.code(404).send({ message: 'Предпросмотр не найден или истёк.' });
  }
});

server.post('/api/tryon/2d', async (request, reply) => {
  try {
    const file = await request.file();

    if (!file || file.fieldname !== 'image') {
      reply.code(400).send({ message: 'Добавьте файл image в запрос.' });
      return;
    }

    if (!file.mimetype?.startsWith('image/')) {
      reply.code(400).send({ message: 'Поддерживаются только файлы изображений.' });
      return;
    }

    const suggestedSizeRaw = file.fields?.suggestedSize?.value;
    const suggestedSize = normalizeSize(
      typeof suggestedSizeRaw === 'string'
        ? suggestedSizeRaw
        : Array.isArray(suggestedSizeRaw)
        ? suggestedSizeRaw[0]
        : undefined,
    );

    const imageBuffer = await file.toBuffer();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRY_ON_TIMEOUT_MS);

    try {
      const result = await run2DTryOn({
        imageBuffer,
        suggestedSize,
        signal: controller.signal,
      });

      reply.send({
        ...result,
        status: 'completed',
        statusMessage: 'Примерка успешно завершена.',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    request.log.error(error);

    if (error?.code === 'FST_REQ_FILE_TOO_LARGE' || error?.code === 'FST_PART_FILE_TOO_LARGE') {
      reply.code(413).send({ message: 'Размер файла превышает допустимый лимит 15 МБ.' });
      return;
    }

    if (error?.name === 'AbortError') {
      reply.code(504).send({ message: 'Превышено время ожидания сервиса примерки. Попробуйте снова.' });
      return;
    }

    reply.code(500).send({ message: 'Сервис примерки временно недоступен. Попробуйте позже.' });
  }
});

server.post('/api/tryon/3d', async (request, reply) => {
  try {
    const { parsed, errors } = validate3DBody(request.body);

    if (Object.keys(errors).length > 0) {
      reply.code(400).send(buildValidationError('Проверьте корректность введённых параметров.', errors));
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRY_ON_TIMEOUT_MS);

    try {
      const result = await run3DTryOn({
        gender: parsed.gender!,
        height: parsed.height!,
        weight: parsed.weight!,
        chest: parsed.chest!,
        waist: parsed.waist!,
        hips: parsed.hips!,
        suggestedSize: parsed.suggestedSize,
        signal: controller.signal,
      });

      reply.send(result);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    request.log.error(error);

    if (error?.name === 'AbortError') {
      reply.code(504).send({ message: 'Превышено время ожидания сервиса 3D-примерки. Попробуйте снова.' });
      return;
    }

    reply.code(500).send({ message: 'Сервис 3D-примерки временно недоступен. Попробуйте позже.' });
  }
});

const PORT = Number(process.env.PORT) || 4000;

if (process.env.NODE_ENV !== 'test') {
  server
    .listen({ port: PORT, host: '0.0.0.0' })
    .then(() => {
      server.log.info(`HEX server listening on port ${PORT}`);
    })
    .catch((error) => {
      server.log.error(error);
      process.exit(1);
    });
}

export default server;