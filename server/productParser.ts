import { parseHtmlProduct } from './parsers/htmlProduct.js';
import { parseWildberriesProduct, fetchWithRedirects, isAllowedMarketplace, ProductFetchError } from './services/marketplace.js';
import type { ParsedProduct } from './types/product.js';

export { ALLOWED_MARKETPLACE_DOMAINS } from './services/marketplace.js';

export async function parseProductFromUrl(inputUrl: string): Promise<ParsedProduct> {
  const targetUrl = new URL(inputUrl);

  if (targetUrl.protocol !== 'https:' || !isAllowedMarketplace(targetUrl.hostname)) {
    throw new ProductFetchError(
      'Неподдерживаемый источник товара. Используйте HTTPS-ссылки wildberries.ru, ozon.ru или lamoda.ru.',
      400,
    );
  }

  if (targetUrl.hostname.includes('wildberries')) {
    const wbProduct = await parseWildberriesProduct(targetUrl);
    if (wbProduct) return wbProduct;
  }

  const controller = new AbortController();
  const timeoutMs = 7000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { html, finalUrl } = await fetchWithRedirects({ url: targetUrl, signal: controller.signal });
    return parseHtmlProduct(html, finalUrl);
  } catch (error: any) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ProductFetchError('Превышено время ожидания загрузки товара', 504);
    }

    if (error instanceof ProductFetchError) {
      throw error;
    }

    throw new ProductFetchError('Ошибка загрузки страницы товара', 502);
  } finally {
    clearTimeout(timeout);
  }
}
