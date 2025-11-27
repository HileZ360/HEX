import { load } from 'cheerio';
import { FALLBACK_IMAGES, normalizeImages } from '../../normalizers/media.js';
import { computeDiscount, ensureNumber } from '../../normalizers/pricing.js';
import { extractSizes } from '../../normalizers/sizing.js';
import { resolveLogger } from '../../logger.js';
import type { ParsedProduct } from '../../types/product.js';
import { parseHtmlProduct } from '../../parsers/htmlProduct.js';
import { ProductFetchError } from '../productFetchError.js';
import { USER_AGENT } from '../http.js';
import type { MarketplaceAdapter } from './types.js';

const safeParseJson = (raw?: string): any | null => {
  if (!raw) return null;
  const content = raw.trim();
  const nuxtMatch = content.match(/__NUXT__\s*=\s*(\{[\s\S]*\})/);

  const candidates = nuxtMatch ? [nuxtMatch[1], content] : [content];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      continue;
    }
  }

  return null;
};

const extractOzonState = (html: string): any | null => {
  const $ = load(html);
  const selectors = ['script#state-web', 'script#state-page', 'script[type="application/json"]'];

  for (const selector of selectors) {
    const scripts = $(selector).toArray();
    for (const script of scripts) {
      const parsed = safeParseJson($(script).html() ?? undefined);
      if (parsed) return parsed;
    }
  }

  const inlineNuxt = $('script')
    .toArray()
    .map((node) => $(node).html()?.trim())
    .find((content) => content?.includes('__NUXT__='));

  return safeParseJson(inlineNuxt ?? undefined);
};

const normalizeArticle = (product: Record<string, unknown>, urlArticle?: string | null) => {
  const candidate =
    product?.sku ??
    product?.id ??
    product?.productId ??
    product?.webProductId ??
    product?.cellTracking?.sku ??
    product?.cellTracking?.id ??
    urlArticle;

  return candidate ? String(candidate) : null;
};

const normalizeImagesFromProduct = (product: Record<string, unknown>) => {
  const images = [
    ...normalizeImages(product?.images ?? product?.media?.images ?? product?.gallery),
    ...normalizeImages(product?.primaryImage ?? product?.image ?? product?.mainImage),
  ];

  if (Array.isArray(product?.media)) {
    images.push(...normalizeImages(product?.media?.map((item: any) => item?.image ?? item?.url)));
  }

  return images.filter(Boolean);
};

const normalizePriceFromProduct = (product: Record<string, unknown>) => {
  const priceSources = [
    product?.price,
    product?.priceValue,
    product?.finalPrice,
    product?.bestPrice,
    product?.discountPrice,
    product?.actionPrice,
    product?.price?.price,
    product?.price?.current,
    product?.cellTracking?.price,
  ];
  const originalSources = [
    product?.originalPrice,
    product?.oldPrice,
    product?.priceWithoutDiscount,
    product?.price?.originalPrice,
    product?.price?.priceOriginal,
    product?.price?.oldPrice,
  ];

  const price = priceSources.map(ensureNumber).find((value) => value !== undefined);
  const originalPrice = originalSources.map(ensureNumber).find((value) => value !== undefined);
  const discount =
    computeDiscount(price, originalPrice) ??
    ensureNumber(product?.discount) ??
    ensureNumber(product?.discountPercent ?? product?.price?.discountPercent);

  return { price, originalPrice, discount };
};

const pickRecommendedSize = (product: Record<string, unknown>): string | null => {
  const recommendation =
    product?.recommendedSize ??
    product?.sizeRecommendation ??
    product?.sizeRecommend ??
    product?.productFit?.recommendedSize ??
    product?.sizeSelection?.recommended;

  return typeof recommendation === 'string' ? recommendation : null;
};

const collectCandidates = (
  value: unknown,
  seen: Set<unknown>,
  list: Record<string, unknown>[],
): Record<string, unknown>[] => {
  if (!value || typeof value !== 'object' || seen.has(value)) return list;
  seen.add(value);

  const obj = value as Record<string, unknown>;
  const looksLikeProduct =
    obj?.name ||
    obj?.title ||
    obj?.cellTracking?.sku ||
    obj?.productId ||
    obj?.price ||
    obj?.priceWithoutDiscount ||
    obj?.images;

  if (looksLikeProduct) {
    list.push(obj);
  }

  for (const child of Object.values(obj)) {
    if (Array.isArray(child)) {
      child.forEach((entry) => collectCandidates(entry, seen, list));
    } else {
      collectCandidates(child, seen, list);
    }
  }

  return list;
};

const pickProductCandidate = (state: any, urlArticle?: string | null): Record<string, unknown> | null => {
  const seen = new Set<unknown>();
  const candidates = collectCandidates(state, seen, []);

  const scored = candidates.map((candidate) => {
    const article = normalizeArticle(candidate, urlArticle);
    const { price } = normalizePriceFromProduct(candidate);
    const images = normalizeImagesFromProduct(candidate);
    let score = 0;
    if (article && urlArticle && article === urlArticle) score += 5;
    if (price !== undefined) score += 2;
    if (images.length) score += 1;
    if (candidate?.name || candidate?.title) score += 1;
    return { candidate, score, article };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best?.candidate ?? null;
};

const toParsedProduct = (product: Record<string, unknown>, targetUrl: URL): ParsedProduct => {
  const articleFromPath = targetUrl.pathname.match(/(\d+)/g)?.pop() ?? null;
  const article = normalizeArticle(product, articleFromPath);
  const { price, originalPrice, discount } = normalizePriceFromProduct(product);
  const images = normalizeImagesFromProduct(product);
  const sizes = extractSizes(product);

  return {
    title: (product?.name as string) ?? (product?.title as string) ?? 'Товар Ozon',
    article,
    price: price ?? null,
    originalPrice: originalPrice ?? null,
    discount: discount ?? null,
    images: images.length ? images : FALLBACK_IMAGES,
    similar: [],
    sizes,
    recommendedSize: pickRecommendedSize(product),
    recommendationConfidence: null,
    fitNotes: [],
    marketplace: targetUrl.hostname,
  };
};

export const ozonAdapter: MarketplaceAdapter = {
  domains: ['ozon.ru'],
  async fetchProduct(targetUrl, logger) {
    const log = resolveLogger(logger);
    const controller = new AbortController();
    const timeoutMs = 7000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let finalUrl = targetUrl;
      let response = await fetch(targetUrl, {
        headers: { 'user-agent': USER_AGENT },
        signal: controller.signal,
        redirect: 'manual',
      });

      const isRedirect = response.status >= 300 && response.status < 400 && response.headers.has('location');
      if (isRedirect) {
        const location = response.headers.get('location');
        if (!location) return null;
        const nextUrl = new URL(location, targetUrl);
        response = await fetch(nextUrl, { headers: { 'user-agent': USER_AGENT }, signal: controller.signal });
        finalUrl = nextUrl;
      }

      if (!response.ok) return null;

      const html = await response.text();
      const state = extractOzonState(html);
      let parsed: ParsedProduct | null = null;

      if (state) {
        const product = pickProductCandidate(state, finalUrl.pathname.match(/(\d+)/g)?.pop() ?? null);
        if (product) {
          parsed = toParsedProduct(product, finalUrl);
        }
      }

      if (!parsed) {
        parsed = parseHtmlProduct(html, finalUrl, logger);
      }

      log.info(`Parsed Ozon product from SSR ${finalUrl.href} [article=${parsed.article ?? 'unknown'}]`);

      return parsed;
    } catch (error: any) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProductFetchError('Превышено время ожидания загрузки товара', 504, {
          context: { url: targetUrl.href },
        });
      }

      if (error instanceof ProductFetchError) {
        throw error;
      }

      throw new ProductFetchError('Ошибка загрузки товара Ozon', 502, {
        cause: error,
        context: { url: targetUrl.href },
      });
    } finally {
      clearTimeout(timeout);
    }
  },
};
