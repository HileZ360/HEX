import type { MarketplaceAdapter } from './types.js';

export const lamodaAdapter: MarketplaceAdapter = {
  domains: ['lamoda.ru'],
  async fetchProduct() {
    return null;
  },
};
