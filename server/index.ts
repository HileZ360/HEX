import Fastify from 'fastify';
import { parseProductFromUrl } from './productParser';

const server = Fastify({ logger: true });

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

server.post('/api/tryon/2d', async (_request, reply) => {
  reply.send({
    recommendedSize: 'M',
    confidence: 0.92,
    imageUrl:
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200&auto=format&fit=crop&q=80',
  });
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
