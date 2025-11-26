import react from '@vitejs/plugin-react';
import { defineConfig, PluginOption } from 'vite';
import { parseProductFromUrl } from './server/productParser';

function productApiMock(): PluginOption {
  const handler = async (req: any, res: any, next: () => void) => {
    if (!req.url) {
      return next();
    }

    const sendJson = (status: number, body: Record<string, unknown>) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };

    if (req.method === 'POST' && ['/api/tryon/2d', '/api/tryon/3d'].includes(req.url)) {
      const is3D = req.url.endsWith('/3d');

      const responseBody = {
        recommendedSize: 'M',
        confidence: 0.92,
        ...(is3D
          ? { renderedImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80' }
          : { imageUrl: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200&auto=format&fit=crop&q=80' }),
      };

      return sendJson(200, responseBody);
    }

    if (!req.url.startsWith('/api/product/parse')) {
      return next();
    }

    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const targetUrl = requestUrl.searchParams.get('url');

      if (!targetUrl) {
        sendJson(400, { error: 'Missing url query param' });
        return;
      }

      const parsedProduct = parseProductFromUrl(targetUrl);

      sendJson(200, parsedProduct);
    } catch (error: any) {
      sendJson(500, { error: error?.message ?? 'Failed to parse product' });
    }
  };

  return {
    name: 'hex-product-api-mock',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), productApiMock()],
});
