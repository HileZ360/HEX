const normalizeSizeValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  if (value && typeof value === 'object') {
    const typed = value as Record<string, unknown>;
    const candidate = typed.name ?? typed.size ?? typed.label ?? typed.title ?? typed.value;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const normalized = String(candidate).trim();
      return normalized || undefined;
    }
  }

  return undefined;
};

export const extractSizes = (product: Record<string, any>): string[] => {
  const rawSizeSources: unknown[] = [];

  const pushIfPresent = (value: unknown) => {
    if (value !== undefined && value !== null) rawSizeSources.push(value);
  };

  const offers = product?.offers ?? product?.offer;
  const offersArray = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of offersArray) {
    pushIfPresent(offer?.size ?? offer?.sizes);
  }

  pushIfPresent(product?.size ?? product?.sizes);

  const flattened = rawSizeSources.flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && Array.isArray((value as any).size)) {
      return (value as any).size;
    }
    return [value];
  });

  return flattened
    .map((value) => normalizeSizeValue(value))
    .filter((size): size is string => Boolean(size));
};

export { normalizeSizeValue };
