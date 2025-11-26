import { URL } from 'node:url';

type ProductParseResult = {
  title: string;
  article?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  media?: { images: string[] };
  images?: string[];
  similar?: { title?: string; price?: number; image?: string }[];
  sizes?: string[];
  size_chart?: { sizes: string[] };
  recommendation?: {
    size?: string;
    confidence?: number;
    notes?: string[];
  };
  marketplace?: string;
};

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80',
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&q=80',
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80',
];

const PRODUCT_MOCKS: Record<string, Partial<ProductParseResult>> = {
  'www.wildberries.ru': {
    title: 'Пуховик утепленный',
    article: 'WB-2048',
    price: 7490,
    originalPrice: 9990,
    media: {
      images: [
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80',
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&q=80',
        'https://images.unsplash.com/photo-1521572295260-07e6d2d48db0?w=1200&q=80',
      ],
    },
    similar: [
      {
        title: 'Пуховик с капюшоном',
        price: 7990,
        image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80',
      },
      {
        title: 'Пальто зимнее',
        price: 6990,
        image: 'https://images.unsplash.com/photo-1521572295260-07e6d2d48db0?w=600&q=80',
      },
    ],
    size_chart: { sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    recommendation: {
      size: 'M',
      confidence: 0.86,
      notes: ['Утепленная модель, свободная посадка'],
    },
  },
  'www.ozon.ru': {
    title: 'Толстовка унисекс',
    article: 'OZ-4821',
    price: 3290,
    originalPrice: 4590,
    images: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&q=80',
      'https://images.unsplash.com/photo-1521572295260-07e6d2d48db0?w=1200&q=80',
    ],
    similar: [
      {
        title: 'Худи базовое',
        price: 2990,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
      },
    ],
    sizes: ['XS', 'S', 'M', 'L'],
    recommendation: {
      size: 'S',
      confidence: 0.73,
      notes: ['Слегка oversize, лучше брать размер в размер'],
    },
  },
  'www.lamoda.ru': {
    title: 'Платье миди',
    article: 'LM-9081',
    price: 5590,
    originalPrice: 7990,
    media: {
      images: [
        'https://images.unsplash.com/photo-1521572295260-07e6d2d48db0?w=1200&q=80',
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&q=80',
      ],
    },
    sizes: ['40', '42', '44', '46'],
    recommendation: {
      size: '42',
      confidence: 0.64,
      notes: ['Ткань эластичная, может слегка тянуться'],
    },
  },
};

export function parseProductFromUrl(inputUrl: string): ProductParseResult {
  const targetUrl = new URL(inputUrl);
  const host = targetUrl.hostname;
  const mock = PRODUCT_MOCKS[host] ?? {};

  const price = mock.price ?? 4490;
  const originalPrice = mock.originalPrice ?? 5490;
  const discount = mock.discount ?? Math.round((1 - price / originalPrice) * 100);
  const images = mock.media?.images ?? mock.images ?? FALLBACK_IMAGES;
  const sizes = mock.size_chart?.sizes ?? mock.sizes ?? ['XS', 'S', 'M', 'L'];

  return {
    title: mock.title ?? 'Товар с маркетплейса',
    article: mock.article ?? targetUrl.pathname.split('/').filter(Boolean).pop(),
    price,
    originalPrice,
    discount,
    media: { images },
    images,
    similar: mock.similar ?? [],
    sizes,
    size_chart: { sizes },
    recommendation: mock.recommendation ?? {
      size: 'M',
      confidence: 0.55,
      notes: ['Рекомендации рассчитаны по умолчанию'],
    },
    marketplace: host,
  };
}
