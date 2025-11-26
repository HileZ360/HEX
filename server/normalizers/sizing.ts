export type SizePrimitive = string | number;

export interface SizeShape {
  name?: SizePrimitive | null;
  size?: SizePrimitive | SizePrimitive[] | null;
  label?: SizePrimitive | null;
  title?: SizePrimitive | null;
  value?: SizePrimitive | null;
  sizes?: SizePrimitive[] | null;
}

export type SizeSource =
  | SizePrimitive
  | SizeShape
  | SizePrimitive[]
  | SizeShape[]
  | { size?: SizePrimitive | SizePrimitive[] | SizeShape | SizeShape[]; sizes?: SizePrimitive[] | SizeShape[] }
  | null
  | undefined;

const normalizeSizeValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  if (value && typeof value === 'object') {
    const typed = value as Record<string, unknown>;
    const candidate = typed.name ?? typed.origName ?? typed.size ?? typed.label ?? typed.title ?? typed.value;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const normalized = String(candidate).trim();
      return normalized || undefined;
    }
  }

  return undefined;
};

const discoverSizeCollections = (product: Record<string, unknown>): SizeSource[] => {
  const collections: SizeSource[] = [];

  const pushIfPresent = (value: SizeSource) => {
    if (value !== undefined && value !== null) collections.push(value);
  };

  const offers = product?.offers ?? (product as Record<string, unknown>)?.offer;
  const offersArray = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of offersArray) {
    const typedOffer = offer as Record<string, unknown>;
    pushIfPresent(typedOffer?.size as SizeSource);
    pushIfPresent(typedOffer?.sizes as SizeSource);
  }

  const typedProduct = product as Record<string, unknown>;
  pushIfPresent(typedProduct?.size as SizeSource);
  pushIfPresent(typedProduct?.sizes as SizeSource);

  return collections;
};

const extractRawSizeValues = (source: SizeSource): unknown[] => {
  if (source === null || source === undefined) return [];

  if (Array.isArray(source)) {
    return source.flatMap((entry) => extractRawSizeValues(entry as SizeSource));
  }

  if (source && typeof source === 'object') {
    const typed = source as Record<string, unknown>;
    const collections: unknown[] = [];

    if ('size' in typed) {
      const sizeValue = typed.size as SizeSource;
      collections.push(sizeValue);
    }

    if ('sizes' in typed) {
      const sizesValue = typed.sizes as SizeSource;
      collections.push(sizesValue);
    }

    if (collections.length) {
      return collections.flatMap((entry) => extractRawSizeValues(entry as SizeSource));
    }
  }

  return [source];
};

const normalizeSizeCollection = (source: SizeSource): string[] => {
  return extractRawSizeValues(source)
    .map((value) => normalizeSizeValue(value))
    .filter((size): size is string => Boolean(size));
};

export const extractSizes = (product: Record<string, unknown>): string[] => {
  const collections = discoverSizeCollections(product);

  const normalized = collections.flatMap((collection) => normalizeSizeCollection(collection));

  const unique = Array.from(new Set(normalized));

  return unique.sort((a, b) => {
    const aNumeric = /^\d+(?:\.\d+)?$/.test(a);
    const bNumeric = /^\d+(?:\.\d+)?$/.test(b);

    if (aNumeric && bNumeric) return Number(a) - Number(b);
    if (aNumeric) return -1;
    if (bNumeric) return 1;

    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
};

export { normalizeSizeValue, discoverSizeCollections, normalizeSizeCollection };
