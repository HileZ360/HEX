import type { MarketplaceAdapter } from './types.js';

export const ozonAdapter: MarketplaceAdapter = {
  domains: ['ozon.ru'],
  async fetchProduct() {
    return null;
  },
};
