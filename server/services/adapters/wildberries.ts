import { FALLBACK_IMAGES } from '../../normalizers/media.js';
import { computeDiscount, ensureNumber } from '../../normalizers/pricing.js';
import { extractSizes } from '../../normalizers/sizing.js';
import { resolveLogger } from '../../logger.js';
import type { ParsedProduct } from '../../types/product.js';
import { USER_AGENT } from '../http.js';
import type { MarketplaceAdapter } from './types.js';

const parseWildberriesImages = (id: number, count: number) => {
  const volume = Math.floor(id / 100000);
  const part = Math.floor(id / 1000);
  const host = String((id % 10) + 1).padStart(2, '0');
  const maxImages = Math.min(count, 8);
  return Array.from({ length: maxImages }, (_, index) =>
    `https://basket-${host}.wb.ru/vol${volume}/part${part}/${id}/images/big/${index + 1}.jpg`,
  );
};

const normalizePrice = (value: unknown): number | undefined => {
  const numeric = ensureNumber(value);
  return numeric !== undefined ? Math.round(numeric / 100) : undefined;
};

const toParsedProduct = (product: any, targetUrl: URL): ParsedProduct => {
  const price = normalizePrice(product?.salePriceU ?? product?.salePrice);
  const originalPrice = normalizePrice(product?.priceU ?? product?.price);
  const discount = computeDiscount(price, originalPrice) ?? ensureNumber(product?.sale) ?? undefined;
  const images = parseWildberriesImages(product.id, product.pics ?? 1);
  const sizes = extractSizes(product);

  return {
    title: product.name ?? 'Товар Wildberries',
    article: product.id ? String(product.id) : null,
    price: price ?? null,
    originalPrice: originalPrice ?? null,
    discount: discount ?? null,
    images: images.length ? images : FALLBACK_IMAGES,
    similar: [],
    sizes,
    recommendedSize: null,
    recommendationConfidence: null,
    fitNotes: [],
    marketplace: targetUrl.hostname,
  };
};

export const wildberriesAdapter: MarketplaceAdapter = {
  domains: ['wildberries.ru'],
  async fetchProduct(targetUrl, logger) {
    const log = resolveLogger(logger);
    const article = targetUrl.pathname.match(/(\d+)/g)?.pop();
    if (!article) return null;

    const apiUrl = `https://card.wb.ru/cards/v2/detail?dest=-1257786&nm=${article}`;
    const response = await fetch(apiUrl, { headers: { 'user-agent': USER_AGENT } });
    if (!response.ok) return null;

    const data = await response.json();
    const product = data?.data?.products?.[0];
    if (!product) return null;

    log.info('Parsed Wildberries product from API', { url: targetUrl.href, article });

    return toParsedProduct(product, targetUrl);
  },
};
