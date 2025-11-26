export const ensureNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (!normalized.trim()) return undefined;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
};

export const computeDiscount = (price?: number, originalPrice?: number) => {
  if (!price || !originalPrice || originalPrice <= 0) return undefined;
  return Math.round((1 - price / originalPrice) * 100);
};

export const extractPriceFromOffers = (offers: any) => {
  if (!offers) return { price: undefined as number | undefined, originalPrice: undefined as number | undefined };

  const offersArray = Array.isArray(offers) ? offers : [offers];
  for (const offer of offersArray) {
    const priceSpecification = ensureNumber(offer?.priceSpecification?.price);
    const listPrice = ensureNumber(offer?.listPrice ?? offer?.priceSpecification?.referencePrice);
    const price = ensureNumber(offer?.price ?? offer?.priceCurrency ?? (!listPrice ? priceSpecification : undefined));
    const original = listPrice ?? (price && priceSpecification && priceSpecification !== price ? priceSpecification : undefined);
    if (price || original) {
      return { price, originalPrice: original };
    }
  }

  return { price: undefined, originalPrice: undefined };
};
