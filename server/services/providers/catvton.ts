import { TryOnProviderError } from '../tryOnProviderError.js';

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

const normalizeNumber = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : undefined;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : undefined;
};

export type CatvtonRequest = {
  apiUrl: string | null | undefined;
  token?: string | null;
  timeoutMs: number;
  userImage: Buffer;
  garmentImageUrl: string;
  suggestedSize?: string;
  pose?: string;
  signal: AbortSignal;
};

export type CatvtonResponse = {
  render: Buffer;
  masks: string[];
  recommendation?: string;
  recommendedSize?: string;
  confidence?: number;
};

export const callCatvtonProvider = async ({
  apiUrl,
  token,
  timeoutMs,
  userImage,
  garmentImageUrl,
  suggestedSize,
  pose,
  signal,
}: CatvtonRequest): Promise<CatvtonResponse> => {
  if (!apiUrl) {
    throw new TryOnProviderError(500, 'Сервис 2D-примерки не настроен. Обратитесь к администратору.');
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (token) {
    headers.Authorization = token.startsWith('Key ') || token.startsWith('Bearer ')
      ? token
      : `Key ${token}`;
  }

  const body: Record<string, unknown> = {
    input_image: `data:image/jpeg;base64,${userImage.toString('base64')}`,
    cloth_image_url: garmentImageUrl,
    output_type: 'base64',
  };

  if (suggestedSize) body.size = suggestedSize;
  if (pose) body.pose = pose;

  const fetchSignal = buildBoundedSignal(signal, timeoutMs);

  let response: Response;

  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: fetchSignal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw error;
    }

    throw new TryOnProviderError(502, 'Сервис примерки недоступен. Попробуйте позже.');
  }

  if (!response.ok) {
    let errorMessage = 'Сервис примерки вернул ошибку.';

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
    throw new TryOnProviderError(502, 'Некорректный ответ сервиса примерки.');
  }

  const base64Render =
    payload?.render ??
    payload?.output?.[0]?.base64 ??
    payload?.result?.image_base64 ??
    payload?.image_base64 ??
    payload?.images?.[0]?.base64 ??
    payload?.images?.[0]?.content ??
    payload?.images?.[0]?.url ??
    payload?.preview;

  const render = decodeBase64Buffer(base64Render, 'render');
  const masks = Array.isArray(payload?.masks)
    ? payload.masks.filter((item: unknown): item is string => typeof item === 'string')
    : [];

  return {
    render,
    masks,
    recommendation: typeof payload?.recommendation === 'string' ? payload.recommendation : undefined,
    recommendedSize:
      typeof payload?.recommendedSize === 'string'
        ? payload.recommendedSize
        : typeof payload?.result?.size === 'string'
        ? payload.result.size
        : undefined,
    confidence: normalizeNumber(payload?.confidence ?? payload?.result?.confidence),
  };
};
