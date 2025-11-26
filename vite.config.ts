import react from '@vitejs/plugin-react';
import { defineConfig, PluginOption } from 'vite';
import { parseProductFromUrl } from './server/productParser';

function productApiMock(): PluginOption {
  const handler = async (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith('/api/product/parse')) {
      return next();
    }

    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const targetUrl = requestUrl.searchParams.get('url');

      if (!targetUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing url query param' }));
        return;
      }

      const parsedProduct = parseProductFromUrl(targetUrl);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(parsedProduct));
    } catch (error: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error?.message ?? 'Failed to parse product' }));
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
