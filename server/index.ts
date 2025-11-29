import Fastify, { FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import { promises as fs } from 'fs';
import path from 'path';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { ALLOWED_MARKETPLACE_DOMAINS, parseProductFromUrl } from './productParser';
import { callCatvtonProvider } from './services/providers/catvton';
import { PreviewStorageError, TryOnProviderError } from './services/tryOnProviderError';

const AVAILABLE_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const TRY_ON_TIMEOUT_MS = Number(process.env.TRY_ON_TIMEOUT_MS ?? 20000);
const TRY_ON_API_URL = process.env.TRY_ON_API_URL;
const TRY_ON_3D_API_URL = process.env.TRY_ON_3D_API_URL ?? TRY_ON_API_URL;
const TRY_ON_API_TOKEN = process.env.TRY_ON_API_TOKEN;
const TRY_ON_PROVIDER_TIMEOUT_MS = Number(process.env.TRY_ON_PROVIDER_TIMEOUT_MS ?? 12000);
const CATVTON_API_URL = process.env.CATVTON_API_URL ?? TRY_ON_API_URL;
const CATVTON_API_TOKEN = process.env.CATVTON_API_TOKEN ?? TRY_ON_API_TOKEN;
const CATVTON_TIMEOUT_MS = Number(process.env.CATVTON_TIMEOUT_MS ?? TRY_ON_PROVIDER_TIMEOUT_MS);

const server = Fastify({ logger: true });
const PREVIEW_DIR = path.join(process.cwd(), 'tmp', 'tryon-previews');
const PREVIEW_ROUTE_PREFIX = '/api/tryon/2d/preview';
const PREVIEW_MANIFEST = path.join(PREVIEW_DIR, 'manifest.json');
const PREVIEW_RETENTION_MINUTES = Number(process.env.PREVIEW_RETENTION_MINUTES ?? 45);
const PREVIEW_MAX_COUNT = Number(process.env.PREVIEW_MAX_COUNT ?? 400);
const PREVIEW_MAX_TOTAL_BYTES = Number(process.env.PREVIEW_MAX_TOTAL_BYTES ?? 200 * 1024 * 1024);
const PREVIEW_CLEANUP_INTERVAL_MS = Number(process.env.PREVIEW_CLEANUP_INTERVAL_MS ?? 10 * 60 * 1000);
const PREVIEW_TOKEN_TTL_MS = Number(process.env.PREVIEW_TOKEN_TTL_MS ?? 15 * 60 * 1000);
const PREVIEW_RATE_LIMIT_WINDOW_MS = Number(process.env.PREVIEW_RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
const PREVIEW_RATE_LIMIT_MAX = Number(process.env.PREVIEW_RATE_LIMIT_MAX ?? 30);
const PRODUCT_RATE_LIMIT_WINDOW_MS = Number(process.env.PRODUCT_RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
const PRODUCT_RATE_LIMIT_MAX = Number(process.env.PRODUCT_RATE_LIMIT_MAX ?? 45);
const PRODUCT_REPEAT_WINDOW_MS = Number(process.env.PRODUCT_REPEAT_WINDOW_MS ?? 2 * 60 * 1000);
const PRODUCT_REPEAT_LIMIT = Number(process.env.PRODUCT_REPEAT_LIMIT ?? 6);
const PRODUCT_URL_MAX_LENGTH = Number(process.env.PRODUCT_URL_MAX_LENGTH ?? 2048);
const PRODUCT_PARSE_MAX_CONCURRENCY = Number(process.env.PRODUCT_PARSE_MAX_CONCURRENCY ?? 4);
const PRODUCT_PARSE_QUEUE_LIMIT = Number(process.env.PRODUCT_PARSE_QUEUE_LIMIT ?? 32);
const PARSED_PRODUCT_TTL_MS = Number(process.env.PARSED_PRODUCT_TTL_MS ?? 20 * 60 * 1000);
const PARSED_PRODUCT_CACHE_LIMIT = Number(process.env.PARSED_PRODUCT_CACHE_LIMIT ?? 50);

const REQUIRED_TRY_ON_ENV = ['TRY_ON_API_URL', 'TRY_ON_API_TOKEN', 'TRY_ON_3D_API_URL'] as const;
const missingTryOnEnv = REQUIRED_TRY_ON_ENV.filter((key) => !(process.env[key]?.trim()));

if (missingTryOnEnv.length > 0) {
  const message = `Missing required env vars for try-on provider: ${missingTryOnEnv.join(', ')}`;

  console.error({ missingTryOnEnv }, message);

  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

const getClientIdentifier = (request: FastifyRequest) => {
  const headerToken = request.headers['x-api-token'] ?? request.headers.authorization;
  if (Array.isArray(headerToken)) {
    const token = headerToken.find(Boolean);
    if (token?.trim()) return token.trim();
  }

  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  return request.ip;
};

server.register(multipart, {
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
    files: 1,
  },
  throwFileSizeLimit: true,
});

let previewDirReady: Promise<void> | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;
let previewTokenSecret: Buffer | null = null;
let previewManifestQueue: Promise<unknown> = Promise.resolve();
const previewRateLimits = new Map<string, { count: number; resetAt: number }>();
const productRateLimits = new Map<string, { count: number; resetAt: number }>();
const productRepeatLimits = new Map<string, { count: number; resetAt: number }>();
const productParseQueue: Array<() => void> = [];
let activeProductParses = 0;
const parsedProducts = new Map<string, { images: string[]; createdAt: number }>();

const cleanupRateLimitMap = (map: Map<string, { count: number; resetAt: number }>) => {
  const now = Date.now();
  for (const [key, entry] of map.entries()) {
    if (entry.resetAt <= now) {
      map.delete(key);
    }
  }
};

const cleanupRateLimits = () => {
  cleanupRateLimitMap(previewRateLimits);
  cleanupRateLimitMap(productRateLimits);
  cleanupRateLimitMap(productRepeatLimits);
};

const getPreviewTokenSecret = () => {
  if (process.env.PREVIEW_TOKEN_SECRET) {
    return Buffer.from(process.env.PREVIEW_TOKEN_SECRET, 'utf8');
  }

  if (!previewTokenSecret) {
    previewTokenSecret = randomBytes(32);
  }

  return previewTokenSecret;
};

const createPreviewSignature = ({ previewId, expiresAt }: { previewId: string; expiresAt: number }) => {
  const hmac = createHmac('sha256', getPreviewTokenSecret());
  hmac.update(`${previewId}:${expiresAt}`);
  return hmac.digest('hex');
};

const isValidPreviewSignature = ({
  previewId,
  token,
  expiresAt,
}: {
  previewId: string;
  token?: string;
  expiresAt?: string;
}) => {
  if (!token || !/^[a-f0-9]{64}$/i.test(token) || !expiresAt) {
    return false;
  }

  const expiresAtMs = Number(expiresAt);

  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    return false;
  }

  const expected = createPreviewSignature({ previewId, expiresAt: expiresAtMs });

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
};

const applyPreviewRateLimit = (ip: string) => {
  const now = Date.now();
  const current = previewRateLimits.get(ip);

  if (!current || current.resetAt <= now) {
    previewRateLimits.set(ip, { count: 1, resetAt: now + PREVIEW_RATE_LIMIT_WINDOW_MS });
    return { allowed: true as const };
  }

  if (current.count >= PREVIEW_RATE_LIMIT_MAX) {
    return { allowed: false as const, retryAt: current.resetAt };
  }

  previewRateLimits.set(ip, { ...current, count: current.count + 1 });
  return { allowed: true as const };
};

const applyProductRateLimit = (key: string) => {
  const now = Date.now();
  const current = productRateLimits.get(key);

  if (!current || current.resetAt <= now) {
    productRateLimits.set(key, { count: 1, resetAt: now + PRODUCT_RATE_LIMIT_WINDOW_MS });
    return { allowed: true as const };
  }

  if (current.count >= PRODUCT_RATE_LIMIT_MAX) {
    return { allowed: false as const, retryAt: current.resetAt };
  }

  productRateLimits.set(key, { ...current, count: current.count + 1 });
  return { allowed: true as const };
};

const applyProductRepeatLimit = (key: string, url: string) => {
  const now = Date.now();
  const repeatKey = `${key}:${url}`;
  const current = productRepeatLimits.get(repeatKey);

  if (!current || current.resetAt <= now) {
    productRepeatLimits.set(repeatKey, { count: 1, resetAt: now + PRODUCT_REPEAT_WINDOW_MS });
    return { allowed: true as const };
  }

  if (current.count >= PRODUCT_REPEAT_LIMIT) {
    return { allowed: false as const, retryAt: current.resetAt };
  }

  productRepeatLimits.set(repeatKey, { ...current, count: current.count + 1 });
  return { allowed: true as const };
};

const cleanupParsedProducts = () => {
  const now = Date.now();
  for (const [id, entry] of parsedProducts.entries()) {
    if (now - entry.createdAt > PARSED_PRODUCT_TTL_MS) {
      parsedProducts.delete(id);
    }
  }

  if (parsedProducts.size > PARSED_PRODUCT_CACHE_LIMIT) {
    const sorted = [...parsedProducts.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    const extra = sorted.slice(0, parsedProducts.size - PARSED_PRODUCT_CACHE_LIMIT);
    for (const [id] of extra) parsedProducts.delete(id);
  }
};

const rememberParsedProduct = (images: string[]) => {
  cleanupParsedProducts();

  const normalizedImages = Array.isArray(images)
    ? images.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  const id = randomUUID();
  parsedProducts.set(id, { images: normalizedImages, createdAt: Date.now() });
  return id;
};

const resolveProductImageUrl = (productId: string, index = 0) => {
  cleanupParsedProducts();
  const entry = parsedProducts.get(productId);
  if (!entry) return null;
  return entry.images[index] ?? entry.images[0] ?? null;
};

const acquireProductParseSlot = () =>
  new Promise<() => void>((resolve, reject) => {
    const tryAcquire = () => {
      if (activeProductParses < PRODUCT_PARSE_MAX_CONCURRENCY) {
        activeProductParses += 1;
        resolve(() => {
          activeProductParses -= 1;
          const next = productParseQueue.shift();
          if (next) next();
        });
        return;
      }

      if (productParseQueue.length >= PRODUCT_PARSE_QUEUE_LIMIT) {
        reject(new Error('Product parse queue limit exceeded'));
        return;
      }

      productParseQueue.push(tryAcquire);
    };

    tryAcquire();
  });

async function ensurePreviewDir() {
  if (!previewDirReady) {
    previewDirReady = fs.mkdir(PREVIEW_DIR, { recursive: true }).then(() => undefined);
  }
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      cleanupPreviews().catch((error) => {
        server.log.error({ err: error }, 'Failed to run scheduled preview cleanup');
      });
      try {
        cleanupRateLimits();
      } catch (error) {
        server.log.error({ err: error }, 'Failed to run scheduled rate-limit cleanup');
      }
    }, PREVIEW_CLEANUP_INTERVAL_MS);
    cleanupTimer.unref?.();
  }
  return previewDirReady;
}

type PreviewManifestEntry = { filename: string; createdAt: number; size: number };

type PreviewManifest = { items: PreviewManifestEntry[] };

const withPreviewManifestLock = async <T>(task: () => Promise<T>) => {
  const currentTask = previewManifestQueue.then(task);
  previewManifestQueue = currentTask.catch(() => undefined);
  return currentTask;
};

const writeFileAtomic = async (filepath: string, data: Buffer | string) => {
  const directory = path.dirname(filepath);
  const tempPath = path.join(directory, `${path.basename(filepath)}.${randomUUID()}.tmp`);

  await fs.writeFile(tempPath, data);
  await fs.rename(tempPath, filepath);
};

const readPreviewManifest = async (): Promise<PreviewManifest> => {
  try {
    const content = await fs.readFile(PREVIEW_MANIFEST, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed?.items)) {
      return { items: parsed.items };
    }
  } catch {}

  return { items: [] };
};

const writePreviewManifest = async (manifest: PreviewManifest) =>
  writeFileAtomic(PREVIEW_MANIFEST, JSON.stringify(manifest, null, 2));

const deletePreviewFile = async (entry: PreviewManifestEntry) => {
  const filepath = path.join(PREVIEW_DIR, entry.filename);
  await fs.rm(filepath, { force: true }).catch(() => undefined);
};

const cleanupPreviewsUnsafe = async () => {
  await ensurePreviewDir();
  const manifest = await readPreviewManifest();
  const now = Date.now();
  const ageLimit = now - PREVIEW_RETENTION_MINUTES * 60 * 1000;

  const remaining: PreviewManifestEntry[] = [];

  for (const entry of manifest.items) {
    if (entry.createdAt < ageLimit) {
      await deletePreviewFile(entry);
      continue;
    }

    const filepath = path.join(PREVIEW_DIR, entry.filename);
    try {
      const stats = await fs.stat(filepath);
      remaining.push({ ...entry, size: stats.size, createdAt: entry.createdAt });
    } catch {
      // File is missing; drop from manifest.
    }
  }

  await writePreviewManifest({ items: remaining });
  return remaining;
};

const cleanupPreviews = () => withPreviewManifestLock(cleanupPreviewsUnsafe);

const enforcePreviewBudgetUnsafe = async (options: { incomingSize: number }) => {
  const { incomingSize } = options;
  if (incomingSize > PREVIEW_MAX_TOTAL_BYTES) {
    throw new PreviewStorageError(
      503,
      'Размер предпросмотра превышает допустимый лимит хранения. Попробуйте другое изображение.',
    );
  }

  const manifest = await cleanupPreviewsUnsafe();
  const sorted = [...manifest].sort((a, b) => a.createdAt - b.createdAt);

  let totalSize = sorted.reduce((acc, item) => acc + item.size, 0);
  const itemsToKeep: PreviewManifestEntry[] = [];

  for (const entry of sorted) {
    if (itemsToKeep.length + 1 > PREVIEW_MAX_COUNT || totalSize + incomingSize > PREVIEW_MAX_TOTAL_BYTES) {
      await deletePreviewFile(entry);
      totalSize -= entry.size;
      continue;
    }
    itemsToKeep.push(entry);
  }

  if (itemsToKeep.length >= PREVIEW_MAX_COUNT || totalSize + incomingSize > PREVIEW_MAX_TOTAL_BYTES) {
    throw new PreviewStorageError(
      429,
      'Лимит предпросмотров исчерпан. Повторите попытку позже, когда освободится место.',
    );
  }

  await writePreviewManifest({ items: itemsToKeep });
  return itemsToKeep;
};

const enforcePreviewBudget = (options: { incomingSize: number }) =>
  withPreviewManifestLock(() => enforcePreviewBudgetUnsafe(options));

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

const buildBoundedSignal = (signal: AbortSignal, timeoutMs: number) => {
  if (timeoutMs <= 0) return signal;

  if (typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => {
    clearTimeout(timeoutId);
    signal.removeEventListener('abort', onAbort);
    controller.abort();
  };

  signal.addEventListener('abort', onAbort);
  return controller.signal;
};

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

  if (!TRY_ON_3D_API_URL) {
    throw new TryOnProviderError(500, 'Сервис 3D-примерки не настроен. Обратитесь к администратору.');
  }

  const providerPayload: Record<string, unknown> = {
    gender,
    height,
    weight,
    chest,
    waist,
    hips,
  };

  if (suggestedSize) {
    providerPayload.suggestedSize = suggestedSize;
  }

  const fetchSignal = buildBoundedSignal(signal, TRY_ON_PROVIDER_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(TRY_ON_3D_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(TRY_ON_API_TOKEN ? { Authorization: `Bearer ${TRY_ON_API_TOKEN}` } : undefined),
      },
      body: JSON.stringify(providerPayload),
      signal: fetchSignal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw abortError('Processing aborted');
    }

    throw new TryOnProviderError(502, 'Сервис 3D-примерки недоступен. Попробуйте позже.');
  }

  if (!response.ok) {
    let errorMessage = 'Сервис 3D-примерки вернул ошибку.';

    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string') errorMessage = payload.message;
      else if (typeof payload?.error === 'string') errorMessage = payload.error;
    } catch {
      const text = await response.text().catch(() => '');
      if (text) errorMessage = text;
    }

    const statusCode = response.status >= 500 ? 502 : response.status;
    throw new TryOnProviderError(statusCode || 502, errorMessage);
  }

  let payload: any;

  try {
    payload = await response.json();
  } catch {
    throw new TryOnProviderError(502, 'Некорректный ответ сервиса 3D-примерки.');
  }

  const recommendedSize =
    normalizeSize(payload?.recommendedSize ?? suggestedSize) ||
    estimateRecommendedSize({ height, weight, chest, waist, hips, fallbackSize: suggestedSize });

  const fitMetrics = Array.isArray(payload?.fitMetrics)
    ? payload.fitMetrics
        .filter((metric: any) => metric?.label && metric?.status)
        .map(
          (metric: any): FitMetric => ({
            label: String(metric.label),
            status: String(metric.status),
            score: typeof metric.score === 'number' ? metric.score : 65,
            detail: metric.detail ? String(metric.detail) : undefined,
          }),
        )
    : [];

  const confidenceBase = 0.78 + (gender === 'female' ? 0.02 : 0);
  const confidenceSpread = Math.min((weight + chest + waist + hips) / 800, 0.12);
  const confidenceFallback = Number(Math.min(confidenceBase + confidenceSpread, 0.96).toFixed(2));
  const confidence = normalizeConfidence(payload?.confidence, confidenceFallback);

  const renderCandidates = [
    payload?.renderUrl,
    payload?.renderedImage,
    payload?.render,
    payload?.imageUrl,
    payload?.image,
    payload?.renderBase64,
  ];

  let renderedImage: string | undefined;

  for (const candidate of renderCandidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const value = candidate.trim();

    if (/^https?:\/\//i.test(value)) {
      renderedImage = value;
      break;
    }

    const renderBuffer = decodeBase64Buffer(value, 'render');
    const persisted = await persistPreview({ buffer: renderBuffer, signal });
    renderedImage = buildPreviewUrl(persisted.filename);
    break;
  }

  const resolvedFitMetrics = fitMetrics.length
    ? fitMetrics
    : buildFitMetrics({ chest, waist, hips, recommendedSize });

  return {
    recommendedSize,
    confidence,
    renderedImage,
    fitMetrics: resolvedFitMetrics,
    status: 'completed' as const,
    statusMessage: '3D-примерка завершена.',
  };
};

const persistPreview = async ({ buffer, signal }: { buffer: Buffer; signal: AbortSignal }) => {
  throwIfAborted(signal);
  await ensurePreviewDir();

  return withPreviewManifestLock(async () => {
    throwIfAborted(signal);

    const itemsToKeep = await enforcePreviewBudgetUnsafe({ incomingSize: buffer.length });

    const id = randomUUID();
    const filename = `${id}.jpg`;
    const filepath = path.join(PREVIEW_DIR, filename);
    const createdAt = Date.now();

    await writeFileAtomic(filepath, buffer);
    await writePreviewManifest({
      items: [...itemsToKeep, { filename, createdAt, size: buffer.length }],
    });

    return { id, filepath, filename } as const;
  });
};

const buildPreviewUrl = (filename: string) => {
  const previewId = filename.replace(/\.jpg$/, '');
  const expiresAt = Date.now() + PREVIEW_TOKEN_TTL_MS;
  const token = createPreviewSignature({ previewId, expiresAt });

  const search = new URLSearchParams({ token, expiresAt: String(expiresAt) });
  return `${PREVIEW_ROUTE_PREFIX}/${previewId}?${search.toString()}`;
};

const decodeBase64Buffer = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TryOnProviderError(502, `Сервис примерки не прислал поле ${field}.`);
  }

  const base64 = value.includes('base64,') ? value.slice(value.indexOf('base64,') + 7) : value;

  try {
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.byteLength) {
      throw new Error('Empty buffer');
    }
    return buffer;
  } catch {
    throw new TryOnProviderError(502, `Некорректные данные ${field} от сервиса примерки.`);
  }
};

const extractFieldValue = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string');
  if (typeof (value as any)?.value === 'string') return (value as any).value;
  return undefined;
};

const normalizeHttpsUrl = (value?: string | null) => {
  if (!value || !value.trim()) return null;

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const normalizeMasks = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const normalizeConfidence = (value: unknown, fallback: number) => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
      ? Number(value)
      : undefined;

  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, 0), 1);
};

const run2DTryOn = async ({
  imageBuffer,
  suggestedSize,
  garmentImageUrl,
  productId,
  pose,
  signal,
}: {
  imageBuffer: Buffer;
  suggestedSize?: string;
  garmentImageUrl?: string | null;
  productId?: string;
  pose?: string;
  signal: AbortSignal;
}) => {
  throwIfAborted(signal);

  if (!CATVTON_API_URL) {
    throw new TryOnProviderError(500, 'Сервис 2D-примерки не настроен. Обратитесь к администратору.');
  }

  const hasExplicitGarmentUrl = typeof garmentImageUrl === 'string' && garmentImageUrl.trim().length > 0;
  const productImageFromCache = productId ? resolveProductImageUrl(productId) : null;
  const resolvedGarmentImageUrl = normalizeHttpsUrl(garmentImageUrl ?? productImageFromCache ?? undefined);

  if (!resolvedGarmentImageUrl) {
    if (productId && !productImageFromCache) {
      throw new TryOnProviderError(400, 'Не найден товар для указанного идентификатора productId.');
    }

    if (hasExplicitGarmentUrl) {
      throw new TryOnProviderError(400, 'Укажите корректную HTTPS-ссылку на изображение одежды.');
    }

    throw new TryOnProviderError(400, 'Добавьте ссылку на изображение одежды для примерки.');
  }

  const providerResult = await callCatvtonProvider({
    apiUrl: CATVTON_API_URL,
    token: CATVTON_API_TOKEN,
    timeoutMs: CATVTON_TIMEOUT_MS,
    userImage: imageBuffer,
    garmentImageUrl: resolvedGarmentImageUrl,
    suggestedSize,
    pose,
    signal,
  });

  const recommendedSize = normalizeSize(providerResult.recommendedSize ?? suggestedSize) ?? 'M';
  const confidence = normalizeConfidence(providerResult.confidence, 0.82);
  const masks = normalizeMasks(providerResult.masks);
  const recommendation =
    typeof providerResult.recommendation === 'string' && providerResult.recommendation.trim()
      ? providerResult.recommendation.trim()
      : `Рекомендуем размер ${recommendedSize}.`;

  const persistedPreview = await persistPreview({ buffer: providerResult.render, signal });
  const previewUrl = buildPreviewUrl(persistedPreview.filename);

  return {
    previewUrl,
    imageUrl: previewUrl,
    recommendedSize,
    confidence,
    masks,
    recommendation,
  } as const;
};

server.get('/api/product/parse', async (request, reply) => {
  const url = (request.query as { url?: string }).url;
  const clientKey = getClientIdentifier(request);

  if (!url) {
    reply.code(400).send({ error: 'Missing url query param' });
    return;
  }

  if (url.length > PRODUCT_URL_MAX_LENGTH) {
    request.log.warn({ urlLength: url.length, clientKey }, 'Product parse blocked: url too long');
    reply.code(429).send({ error: 'Ссылка слишком длинная. Попробуйте другой адрес товара.' });
    return;
  }

  const productRateLimit = applyProductRateLimit(clientKey);
  if (!productRateLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((productRateLimit.retryAt - Date.now()) / 1000));
    reply.header('Retry-After', String(retryAfterSeconds));
    request.log.warn({ clientKey, ip: request.ip }, 'Product parse rate limit exceeded');
    reply.code(429).send({ error: 'Слишком много запросов. Попробуйте позже.' });
    return;
  }

  const productRepeatLimit = applyProductRepeatLimit(clientKey, url);
  if (!productRepeatLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((productRepeatLimit.retryAt - Date.now()) / 1000));
    reply.header('Retry-After', String(retryAfterSeconds));
    request.log.warn({ clientKey, url }, 'Product parse blocked due to repeated URL');
    reply
      .code(429)
      .send({ error: 'Слишком частые запросы одного и того же товара. Попробуйте позже.' });
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
    let releaseSlot: (() => void) | undefined;

    try {
      releaseSlot = await acquireProductParseSlot();
    } catch (error) {
      request.log.warn({ clientKey, err: error }, 'Product parse queue is full');
      reply
        .code(429)
        .send({ error: 'Слишком много одновременных запросов на загрузку товара. Попробуйте позже.' });
      return;
    }

    try {
      const parsedProduct = await parseProductFromUrl(url, request.log);
      const productId = rememberParsedProduct(parsedProduct.images ?? []);

      reply.send({
        productId,
        title: parsedProduct.title,
        article: parsedProduct.article ?? null,
        price: parsedProduct.price ?? null,
        originalPrice: parsedProduct.originalPrice ?? null,
        discount: parsedProduct.discount ?? null,
        images: parsedProduct.images ?? [],
        primaryImage: parsedProduct.images?.[0] ?? null,
        similar: parsedProduct.similar ?? [],
        sizes: parsedProduct.sizes ?? [],
        recommendedSize: parsedProduct.recommendedSize ?? null,
        recommendationConfidence: parsedProduct.recommendationConfidence ?? null,
        fitNotes: parsedProduct.fitNotes ?? [],
        marketplace: parsedProduct.marketplace,
      });
    } finally {
      releaseSlot?.();
    }
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    const message =
      statusCode === 504
        ? 'Превышено время ожидания загрузки товара'
        : error?.message ?? 'Failed to parse product';

    const context = error instanceof Error ? (error as any).context : undefined;
    request.log.error({ err: error, context, cause: error?.cause }, 'Product parsing failed');

    reply.code(statusCode).send({ error: message });
  }
});

server.get(`${PREVIEW_ROUTE_PREFIX}/:id`, async (request, reply) => {
  const { id } = request.params as { id?: string };
  const { token, expiresAt } = request.query as { token?: string; expiresAt?: string };

  if (!id || !/^[-a-f0-9]+$/i.test(id)) {
    reply.code(400).send({ message: 'Укажите корректный идентификатор предпросмотра.' });
    return;
  }

  const rateLimit = applyPreviewRateLimit(request.ip);
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.retryAt - Date.now()) / 1000));
    reply.header('Retry-After', String(retryAfterSeconds));
    reply.code(429).send({ message: 'Слишком много запросов предпросмотра. Повторите позже.' });
    return;
  }

  const hasValidSignature = isValidPreviewSignature({ previewId: id, token, expiresAt });
  if (!hasValidSignature) {
    reply.code(403).send({ message: 'Доступ к предпросмотру запрещён.' });
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

    const garmentImageUrl = extractFieldValue(
      (file.fields as any)?.garmentImageUrl?.value ?? (file.fields as any)?.garmentImageUrl,
    );
    const productId = extractFieldValue((file.fields as any)?.productId?.value ?? (file.fields as any)?.productId);
    const pose = extractFieldValue((file.fields as any)?.pose?.value ?? (file.fields as any)?.pose);

    const imageBuffer = await file.toBuffer();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRY_ON_TIMEOUT_MS);

    try {
      const result = await run2DTryOn({
        imageBuffer,
        suggestedSize,
        garmentImageUrl,
        productId,
        pose,
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

    if (error instanceof PreviewStorageError) {
      reply.code(error.statusCode).send({ message: error.message });
      return;
    }

    if (error instanceof TryOnProviderError) {
      reply.code(error.statusCode || 502).send({ message: error.message });
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

    if (error instanceof TryOnProviderError) {
      reply.code(error.statusCode || 502).send({ message: error.message });
      return;
    }

    if (error?.name === 'AbortError') {
      reply.code(504).send({ message: 'Превышено время ожидания сервиса 3D-примерки. Попробуйте снова.' });
      return;
    }

    reply.code(500).send({ message: 'Сервис 3D-примерки временно недоступен. Попробуйте позже.' });
  }
});

export const __previewTestHelpers =
  process.env.NODE_ENV === 'test'
    ? {
        persistPreviewForTest: persistPreview,
        readPreviewManifestForTest: () => withPreviewManifestLock(() => readPreviewManifest()),
        resetPreviewStorageForTest: async () => {
          await fs.rm(PREVIEW_DIR, { recursive: true, force: true });
          previewDirReady = null;
          previewManifestQueue = Promise.resolve();
        },
        previewDir: PREVIEW_DIR,
      }
    : undefined;

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
