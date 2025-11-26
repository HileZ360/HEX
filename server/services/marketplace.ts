import { computeDiscount } from '../normalizers/pricing.js';
import { FALLBACK_IMAGES } from '../normalizers/media.js';
import type { ParsedProduct } from '../types/product.js';

export const ALLOWED_MARKETPLACE_DOMAINS = ['wildberries.ru', 'ozon.ru', 'lamoda.ru'] as const;
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

export class ProductFetchError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ProductFetchError';
  }
}

export const isAllowedMarketplace = (hostname: string) =>
  ALLOWED_MARKETPLACE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

const parseWildberriesImages = (id: number, count: number) => {
  const volume = Math.floor(id / 100000);
  const part = Math.floor(id / 1000);
  const host = String((id % 10) + 1).padStart(2, '0');
  const maxImages = Math.min(count, 8);
  return Array.from({ length: maxImages }, (_, index) =>
    `https://basket-${host}.wb.ru/vol${volume}/part${part}/${id}/images/big/${index + 1}.jpg`,
  );
};

export const fetchWithRedirects = async ({
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

export const parseWildberriesProduct = async (targetUrl: URL): Promise<ParsedProduct | null> => {
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
