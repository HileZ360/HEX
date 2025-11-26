import { ensureNumber } from './pricing.js';
import { normalizeImages } from './media.js';

export type SimilarItem = { title?: string; price?: number; image?: string };

const normalizeTitle = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const normalizeSimilarItems = (items: unknown): SimilarItem[] => {
  const collection = Array.isArray(items) ? items : items ? [items] : [];

  const seen = new Set<string>();
  const normalized: SimilarItem[] = [];

  for (const entry of collection) {
    if (!entry || typeof entry !== 'object') continue;
    const typed = entry as Record<string, unknown>;

    const title = normalizeTitle(typed.name ?? typed.title);
    const price = ensureNumber((typed as any)?.offers?.price ?? typed.price);
    const image = normalizeImages((typed as any)?.image)[0]?.trim() || undefined;

    if (!title && !image) continue;

    const key = `${title ?? ''}||${image ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({ title, price, image });
  }

  return normalized;
};
