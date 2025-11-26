export type ParsedProduct = {
  title: string;
  article?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  discount?: number | null;
  images: string[];
  similar: { title?: string; price?: number; image?: string }[];
  sizes: string[];
  recommendedSize?: string | null;
  recommendationConfidence?: number | null;
  fitNotes?: string[];
  marketplace?: string;
};
