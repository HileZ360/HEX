import { load } from 'cheerio';

export const safeJsonParse = (content: string) => {
  try {
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

export const findProductObject = (value: unknown): any | null => {
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

export const extractJsonLdProduct = ($: ReturnType<typeof load>) => {
  const scripts = $('script[type="application/ld+json"]');
  for (const element of scripts.toArray()) {
    const content = $(element).contents().text();
    const parsed = safeJsonParse(content);
    const product = findProductObject(parsed);
    if (product) return product;
  }
  return null;
};
