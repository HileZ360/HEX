import { load } from 'cheerio';
import { FALLBACK_IMAGES, normalizeImages } from '../../normalizers/media.js';
import { computeDiscount, ensureNumber, extractPriceFromOffers } from '../../normalizers/pricing.js';
import { extractSizes, normalizeSizeCollection } from '../../normalizers/sizing.js';
import { extractJsonLdProduct } from '../../parsers/jsonld.js';
import { resolveLogger } from '../../logger.js';
import type { ParsedProduct } from '../../types/product.js';
import { ProductFetchError } from '../productFetchError.js';
import { USER_AGENT } from '../http.js';
import type { MarketplaceAdapter } from './types.js';

const extractMetaContent = ($: ReturnType<typeof load>, selectors: string[]) => {
  for (const selector of selectors) {
    const value = $(selector).attr('content')?.trim();
    if (value) return value;
  }
  return undefined;
};

const collectDomSizes = ($: ReturnType<typeof load>): string[] => {
  const rawSizes: unknown[] = [];
  const sizeSelectors = [
    '[data-size-name]',
    '[data-size-value]',
    '[data-size]',
    '[data-e2e-size]',
    '[data-testid="size-variant"]',
    '[data-qaid="size_variant"]',
    '[data-qaid="size_list_item"]',
    '.sizes-list__button',
    'button[aria-label*="Размер" i]',
  ];

  for (const selector of sizeSelectors) {
    $(selector).each((_, element) => {
      const node = $(element);
      const attributes = ['data-size-name', 'data-size-value', 'data-size', 'data-e2e-size'];
      for (const attr of attributes) {
        const value = node.attr(attr);
        if (value) rawSizes.push(value);
      }

      const text = node.text().trim();
      if (text) rawSizes.push(text);
    });
  }

  const normalizedDomSizes = normalizeSizeCollection(rawSizes);
  return extractSizes({ sizes: normalizedDomSizes });
};

const parseLamodaProduct = (html: string, targetUrl: URL, logger?: ReturnType<typeof resolveLogger>): ParsedProduct => {
  const log = resolveLogger(logger);
  const $ = load(html);
  const jsonLdProduct = extractJsonLdProduct($) ?? {};

  const { price: offerPrice, originalPrice: offerOriginal } = extractPriceFromOffers(
    jsonLdProduct.offers ?? jsonLdProduct.offer,
  );
  const metaPrice = extractMetaContent($, ['meta[property="product:price:amount"]', 'meta[itemprop="price"]']);
  const price = offerPrice ?? ensureNumber(metaPrice);
  const originalPrice = offerOriginal ?? ensureNumber(extractMetaContent($, ['meta[itemprop="highPrice"]']));
  const discount = computeDiscount(price, originalPrice) ?? ensureNumber(jsonLdProduct.discount);

  const article =
    jsonLdProduct.sku ??
    jsonLdProduct.mpn ??
    extractMetaContent($, ['meta[itemprop="sku"]', 'meta[property="product:retailer_item_id"]']) ??
    $('[data-article]').attr('data-article') ??
    targetUrl.pathname.split('/').filter(Boolean).pop() ??
    null;

  const images = [
    ...normalizeImages(jsonLdProduct.image),
    ...normalizeImages(extractMetaContent($, ['meta[property="og:image"]'])),
  ].filter(Boolean);

  const sizes = (() => {
    const jsonSizes = extractSizes(jsonLdProduct);
    const domSizes = collectDomSizes($);
    const unique = new Set([...jsonSizes, ...domSizes]);
    return extractSizes({ sizes: Array.from(unique) });
  })();

  const titleFromTag = $('title').text().trim();
  const title =
    (jsonLdProduct.name as string) ??
    extractMetaContent($, ['meta[property="og:title"]']) ??
    (titleFromTag || undefined) ??
    'Товар Lamoda';

  if (!images.length) {
    log.debug('Lamoda images fallback used', { url: targetUrl.href });
  }

  return {
    title,
    article,
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

export const lamodaAdapter: MarketplaceAdapter = {
  domains: ['lamoda.ru'],
  async fetchProduct(targetUrl, logger, signal) {
    const log = resolveLogger(logger);
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
        throw new DOMException('Aborted', 'AbortError');
      }

      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: { 'user-agent': USER_AGENT },
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const html = await response.text();
      const product = parseLamodaProduct(html, targetUrl, log);

      log.info(
        `Parsed Lamoda product from HTML ${targetUrl.href} [article=${product.article ?? 'unknown'}]`,
      );

      return product;
    } catch (error: any) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (timedOut) {
          throw new ProductFetchError('Превышено время ожидания загрузки товара', 504, {
            context: { url: targetUrl.href },
          });
        }

        throw error;
      }

      if (error instanceof ProductFetchError) {
        throw error;
      }

      throw new ProductFetchError('Ошибка загрузки товара Lamoda', 502, {
        cause: error,
        context: { url: targetUrl.href },
      });
    } finally {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      clearTimeout(timeout);
    }
  },
};
