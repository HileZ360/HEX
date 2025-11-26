import { load } from 'cheerio';
import { computeDiscount, ensureNumber, extractPriceFromOffers } from '../normalizers/pricing.js';
import { FALLBACK_IMAGES, normalizeImages } from '../normalizers/media.js';
import { extractSizes } from '../normalizers/sizing.js';
import { normalizeSimilarItems } from '../normalizers/similar.js';
import { extractJsonLdProduct } from './jsonld.js';
import type { ParsedProduct } from '../types/product.js';

const extractMetaContent = ($: ReturnType<typeof load>, selectors: string[]) => {
  for (const selector of selectors) {
    const value = $(selector).attr('content')?.trim();
    if (value) return value;
  }
  return undefined;
};

export const parseHtmlProduct = (html: string, targetUrl: URL): ParsedProduct => {
  const $ = load(html);
  const product = extractJsonLdProduct($) ?? {};

  const { price: offerPrice, originalPrice } = extractPriceFromOffers(product.offers ?? product.offer);
  const metaPrice = extractMetaContent($, ['meta[property="product:price:amount"]', 'meta[itemprop="price"]']);
  const price = offerPrice ?? ensureNumber(metaPrice);

  const article =
    product.sku ??
    product.mpn ??
    extractMetaContent($, ['meta[property="product:retailer_item_id"]', 'meta[itemprop="sku"]']) ??
    targetUrl.pathname.split('/').filter(Boolean).pop();

  const discount = product.discount ?? computeDiscount(price, originalPrice);

  const images = [
    ...normalizeImages(product.image),
    ...normalizeImages(extractMetaContent($, ['meta[property="og:image"]'])),
  ].filter(Boolean);

  const sizes = extractSizes(product);
  const similar = normalizeSimilarItems(product.isSimilarTo);

  return {
    title: product.name ?? extractMetaContent($, ['meta[property="og:title"]']) ?? $('title').text() ?? 'Товар',
    article: article ?? null,
    price: price ?? null,
    originalPrice: originalPrice ?? null,
    discount: discount ?? null,
    images: images.length ? images : FALLBACK_IMAGES,
    similar,
    sizes: sizes.length ? sizes : [],
    recommendedSize: product?.sizeRecommendation ?? null,
    recommendationConfidence: product?.recommendationConfidence ?? null,
    fitNotes: product?.fitNotes ?? [],
    marketplace: targetUrl.hostname,
  };
};
