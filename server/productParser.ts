import { load } from 'cheerio';
import { URL } from 'node:url';

export const ALLOWED_MARKETPLACE_DOMAINS = ['wildberries.ru', 'ozon.ru', 'lamoda.ru'] as const;

export type ParsedProduct = {
  title: string;
  article?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  discount?: number | null;
  images: string[];
  similar: { title?: string; price?: number; image?: string }[];
  sizes: string[];
  recommendedSize?: string | null;
  recommendationConfidence?: number | null;
  fitNotes?: string[];
  marketplace?: string;
};

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&q=80&auto=format&fit=crop',
];

const ensureNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
};

const computeDiscount = (price?: number, originalPrice?: number) => {
  if (!price || !originalPrice || originalPrice <= 0) return undefined;
  return Math.round((1 - price / originalPrice) * 100);
};

const normalizeImages = (images: unknown): string[] => {
  if (!images) return [];
  const arrayImages = Array.isArray(images) ? images : [images];
  return arrayImages
    .map((img) => (typeof img === 'string' ? img : undefined))
    .filter((img): img is string => Boolean(img));
};

const safeJsonParse = (content: string) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

const findProductObject = (value: unknown): any | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const product = findProductObject(item);
      if (product) return product;
    }
    return null;
  }

  if (typeof value === 'object') {
    const typed = value as Record<string, any>;
    const type = typed['@type'] ?? typed.type;
    if (typeof type === 'string' && type.toLowerCase().includes('product')) {
      return typed;
    }

    for (const key of Object.keys(typed)) {
      const product = findProductObject(typed[key]);
      if (product) return product;
    }
  }

  return null;
};

const extractJsonLdProduct = ($: ReturnType<typeof load>) => {
  const scripts = $('script[type="application/ld+json"]');
  for (const element of scripts.toArray()) {
    const content = $(element).contents().text();
    const parsed = safeJsonParse(content);
    const product = findProductObject(parsed);
    if (product) return product;
  }
  return null;
};

const extractMetaContent = ($: ReturnType<typeof load>, selectors: string[]) => {
  for (const selector of selectors) {
    const value = $(selector).attr('content')?.trim();
    if (value) return value;
  }
  return undefined;
};

const parseWildberriesImages = (id: number, count: number) => {
  const volume = Math.floor(id / 100000);
  const part = Math.floor(id / 1000);
  const host = String((id % 10) + 1).padStart(2, '0');
  const maxImages = Math.min(count, 8);
  return Array.from({ length: maxImages }, (_, index) =>
    `https://basket-${host}.wb.ru/vol${volume}/part${part}/${id}/images/big/${index + 1}.jpg`
  );
};

const parseWildberriesProduct = async (targetUrl: URL): Promise<ParsedProduct | null> => {
  const article = targetUrl.pathname.match(/(\d+)/g)?.pop();
  if (!article) return null;

  const apiUrl = `https://card.wb.ru/cards/v2/detail?dest=-1257786&nm=${article}`;
  const response = await fetch(apiUrl, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) return null;

  const data = await response.json();
  const product = data?.data?.products?.[0];
  if (!product) return null;

  const price = product.salePriceU ? Math.round(product.salePriceU / 100) : undefined;
  const originalPrice = product.priceU ? Math.round(product.priceU / 100) : undefined;
  const discount = computeDiscount(price, originalPrice) ?? product.sale ?? undefined;
  const images = parseWildberriesImages(product.id, product.pics ?? 1);
  const sizes = (product.sizes ?? [])
    .map((size: any) => size.name ?? size.origName ?? size.optionName)
    .filter(Boolean);

  return {
    title: product.name ?? 'Товар Wildberries',
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

const extractPriceFromOffers = (offers: any) => {
  if (!offers) return { price: undefined as number | undefined, originalPrice: undefined as number | undefined };

  const offersArray = Array.isArray(offers) ? offers : [offers];
  for (const offer of offersArray) {
    const price = ensureNumber(offer?.price ?? offer?.priceCurrency);
    const original = ensureNumber(offer?.priceSpecification?.price ?? offer?.listPrice);
    if (price || original) {
      return { price, originalPrice: original };
    }
  }

  return { price: undefined, originalPrice: undefined };
};

const parseHtmlProduct = (html: string, targetUrl: URL): ParsedProduct => {
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

  const sizes = normalizeImages(product?.offers?.size ?? product?.size) ?? [];
  const similarRaw = (product.isSimilarTo ?? []) as any[];
  const similar = Array.isArray(similarRaw)
    ? similarRaw
        .map((item) => ({
          title: item?.name ?? item?.title,
          price: ensureNumber(item?.offers?.price ?? item?.price),
          image: normalizeImages(item?.image)[0],
        }))
        .filter((item) => item.title || item.image)
    : [];

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

class ProductFetchError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ProductFetchError';
  }
}

const isAllowedMarketplace = (hostname: string) =>
  ALLOWED_MARKETPLACE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

const fetchWithRedirects = async ({
  url,
  signal,
  maxRedirects = 3,
}: {
  url: URL;
  signal: AbortSignal;
  maxRedirects?: number;
}) => {
  let currentUrl = url;

  for (let attempt = 0; attempt <= maxRedirects; attempt++) {
    const response = await fetch(currentUrl, {
      headers: { 'user-agent': USER_AGENT },
      signal,
      redirect: 'manual',
    });

    const isRedirect = response.status >= 300 && response.status < 400 && response.headers.has('location');
    if (isRedirect) {
      const location = response.headers.get('location');
      const nextUrl = location ? new URL(location, currentUrl) : null;

      if (!nextUrl || nextUrl.protocol !== 'https:' || !isAllowedMarketplace(nextUrl.hostname)) {
        throw new ProductFetchError('Редирект на неподдерживаемый домен.', 400);
      }

      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      throw new ProductFetchError(`Не удалось загрузить страницу товара: ${response.status}`, 502);
    }

    const html = await response.text();
    return { html, finalUrl: currentUrl } as const;
  }

  throw new ProductFetchError('Слишком много редиректов при загрузке товара.', 502);
};

export async function parseProductFromUrl(inputUrl: string): Promise<ParsedProduct> {
  const targetUrl = new URL(inputUrl);

  if (targetUrl.protocol !== 'https:' || !isAllowedMarketplace(targetUrl.hostname)) {
    throw new ProductFetchError('Неподдерживаемый источник товара. Используйте HTTPS-ссылки wildberries.ru, ozon.ru или lamoda.ru.', 400);
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
