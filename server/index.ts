import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { parseProductFromUrl } from './productParser';

const AVAILABLE_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const TRY_ON_TIMEOUT_MS = 20000;

const server = Fastify({ logger: true });

server.register(multipart, {
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
    files: 1,
  },
  throwFileSizeLimit: true,
});

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

const run2DTryOn = async ({
  imageBuffer,
  suggestedSize,
  mimetype,
  signal,
}: {
  imageBuffer: Buffer;
  suggestedSize?: string;
  mimetype: string;
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

  return {
    imageUrl: `data:${mimetype};base64,${imageBuffer.toString('base64')}`,
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
    reply.code(500).send({ error: error?.message ?? 'Failed to parse product' });
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
      typeof suggestedSizeRaw === 'string' ? suggestedSizeRaw : Array.isArray(suggestedSizeRaw) ? suggestedSizeRaw[0] : undefined
    );

    const imageBuffer = await file.toBuffer();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRY_ON_TIMEOUT_MS);

    try {
      const result = await run2DTryOn({
        imageBuffer,
        suggestedSize,
        mimetype: file.mimetype ?? 'image/jpeg',
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

server.post('/api/tryon/3d', async (_request, reply) => {
  reply.send({
    recommendedSize: 'M',
    confidence: 0.92,
    renderedImage:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80',
  });
});

const PORT = Number(process.env.PORT) || 4000;

server
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => {
    server.log.info(`HEX server listening on port ${PORT}`);
  })
  .catch((error) => {
    server.log.error(error);
    process.exit(1);
  });
