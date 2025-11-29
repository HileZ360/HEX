import { parseHtmlProduct } from './parsers/htmlProduct.js';
import {
  fetchMarketplaceProduct,
  fetchWithRedirects,
  isAllowedMarketplace,
  ProductFetchError,
} from './services/marketplace.js';
import type { ParsedProduct } from './types/product.js';
import type { ParseLogger } from './logger.js';

export { ALLOWED_MARKETPLACE_DOMAINS } from './services/marketplace.js';

const abortError = (message: string) => {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
};

export async function parseProductFromUrl(
  inputUrl: string,
  logger?: ParseLogger,
  signal?: AbortSignal,
): Promise<ParsedProduct> {
  const targetUrl = new URL(inputUrl);
  const redirectContext = { url: targetUrl.href };

  if (signal?.aborted) {
    throw abortError('Product parse aborted');
  }

  if (targetUrl.protocol !== 'https:' || !isAllowedMarketplace(targetUrl.hostname)) {
    throw new ProductFetchError(
      'Неподдерживаемый источник товара. Используйте HTTPS-ссылки wildberries.ru, ozon.ru или lamoda.ru.',
      400,
      { context: redirectContext },
    );
  }

  const marketplaceProduct = await fetchMarketplaceProduct(targetUrl, logger, signal);
  if (marketplaceProduct) {
    return marketplaceProduct;
  }

  if (targetUrl.hostname.includes('wildberries')) {
    logger?.warn?.('Falling back to HTML parser after empty Wildberries API response', {
      url: targetUrl.href,
    });
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const timeoutMs = 7000;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeout);
      throw abortError('Product parse aborted');
    }

    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const { html, finalUrl } = await fetchWithRedirects({
      url: targetUrl,
      signal: controller.signal,
      logger,
    });
    return parseHtmlProduct(html, finalUrl, logger);
  } catch (error: any) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (timedOut) {
        throw new ProductFetchError('Превышено время ожидания загрузки товара', 504, {
          context: redirectContext,
        });
      }

      throw error;
    }

    if (error instanceof ProductFetchError) {
      throw error;
    }

    throw new ProductFetchError('Ошибка загрузки страницы товара', 502, {
      cause: error,
      context: redirectContext,
    });
  } finally {
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
    clearTimeout(timeout);
  }
}
