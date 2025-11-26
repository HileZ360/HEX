import { FALLBACK_IMAGES } from '../normalizers/media.js';
import { resolveLogger, type ParseLogger } from '../logger.js';
import { ProductFetchError } from './productFetchError.js';
import { marketplaceAdapters, findAdapterByHostname } from './adapters/index.js';
import { hostMatchesDomain } from './adapters/types.js';
import { USER_AGENT } from './http.js';

export { ProductFetchError } from './productFetchError.js';

export const ALLOWED_MARKETPLACE_DOMAINS = marketplaceAdapters.flatMap((adapter) => adapter.domains);

export const isAllowedMarketplace = (hostname: string) =>
  marketplaceAdapters.some((adapter) => adapter.domains.some((domain) => hostMatchesDomain(hostname, domain)));

export const fetchMarketplaceProduct = async (url: URL, logger?: ParseLogger) => {
  const adapter = findAdapterByHostname(url.hostname);
  if (!adapter) return null;
  return adapter.fetchProduct(url, logger);
};

export const fetchWithRedirects = async ({
  url,
  signal,
  maxRedirects = 3,
  logger,
}: {
  url: URL;
  signal: AbortSignal;
  maxRedirects?: number;
  logger?: ParseLogger;
}) => {
  const log = resolveLogger(logger);
  const redirectChain = [url.href];
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
        throw new ProductFetchError('Редирект на неподдерживаемый домен.', 400, {
          context: { redirectChain, location },
        });
      }

      log.debug('Following redirect during product fetch', {
        from: currentUrl.href,
        to: nextUrl.href,
        attempt,
      });

      currentUrl = nextUrl;
      redirectChain.push(currentUrl.href);
      continue;
    }

    if (!response.ok) {
      throw new ProductFetchError(`Не удалось загрузить страницу товара: ${response.status}`, 502, {
        context: { redirectChain, status: response.status },
      });
    }

    const html = await response.text();
    log.info('Fetched product page', { finalUrl: currentUrl.href, redirectChain });
    return { html, finalUrl: currentUrl } as const;
  }

  throw new ProductFetchError('Слишком много редиректов при загрузке товара.', 502, {
    context: { redirectChain },
  });
};

export const FALLBACK_PRODUCT = {
  title: 'Товар',
  images: FALLBACK_IMAGES,
  similar: [],
  sizes: [],
  fitNotes: [],
} as const;
