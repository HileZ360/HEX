export const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&q=80&auto=format&fit=crop',
];

export const normalizeImages = (images: unknown): string[] => {
  if (!images) return [];
  const arrayImages = Array.isArray(images) ? images : [images];
  return arrayImages
    .map((img) => (typeof img === 'string' ? img : undefined))
    .filter((img): img is string => Boolean(img));
};
