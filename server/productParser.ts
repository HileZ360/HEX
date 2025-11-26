import { parseHtmlProduct } from './parsers/htmlProduct.js';
import { parseWildberriesProduct, fetchWithRedirects, isAllowedMarketplace, ProductFetchError } from './services/marketplace.js';
import type { ParsedProduct } from './types/product.js';
import type { ParseLogger } from './logger.js';

export { ALLOWED_MARKETPLACE_DOMAINS } from './services/marketplace.js';

export async function parseProductFromUrl(inputUrl: string, logger?: ParseLogger): Promise<ParsedProduct> {
  const targetUrl = new URL(inputUrl);
  const redirectContext = { url: targetUrl.href };

  if (targetUrl.protocol !== 'https:' || !isAllowedMarketplace(targetUrl.hostname)) {
    throw new ProductFetchError(
      'Неподдерживаемый источник товара. Используйте HTTPS-ссылки wildberries.ru, ozon.ru или lamoda.ru.',
      400,
      { context: redirectContext },
    );
  }

  if (targetUrl.hostname.includes('wildberries')) {
    const wbProduct = await parseWildberriesProduct(targetUrl, logger);
    if (!wbProduct) {
      logger?.warn?.('Falling back to HTML parser after empty Wildberries API response', {
        url: targetUrl.href,
      });
    }
    if (wbProduct) return wbProduct;
  }

  const controller = new AbortController();
  const timeoutMs = 7000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { html, finalUrl } = await fetchWithRedirects({
      url: targetUrl,
      signal: controller.signal,
      logger,
    });
    return parseHtmlProduct(html, finalUrl, logger);
  } catch (error: any) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ProductFetchError('Превышено время ожидания загрузки товара', 504, {
        context: redirectContext,
      });
    }

    if (error instanceof ProductFetchError) {
      throw error;
    }

    throw new ProductFetchError('Ошибка загрузки страницы товара', 502, {
      cause: error,
      context: redirectContext,
    });
  } finally {
    clearTimeout(timeout);
  }
}
