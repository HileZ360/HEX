import { hostMatchesDomain, type MarketplaceAdapter } from './types.js';
import { lamodaAdapter } from './lamoda.js';
import { ozonAdapter } from './ozon.js';
import { wildberriesAdapter } from './wildberries.js';

export const marketplaceAdapters: MarketplaceAdapter[] = [wildberriesAdapter, ozonAdapter, lamodaAdapter];

export const findAdapterByHostname = (hostname: string) =>
  marketplaceAdapters.find((adapter) => adapter.domains.some((domain) => hostMatchesDomain(hostname, domain)));
