import type { ParseLogger } from '../../logger.js';
import type { ParsedProduct } from '../../types/product.js';

export interface MarketplaceAdapter {
  domains: readonly string[];
  fetchProduct: (url: URL, logger?: ParseLogger, signal?: AbortSignal) => Promise<ParsedProduct | null>;
}

export const hostMatchesDomain = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`);
