import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { TryOn2DModal } from '../components/TryOn2DModal';
import { TryOn3DModal } from '../components/TryOn3DModal';
import { Camera, Box, Heart, Share2, Sparkles, ArrowLeft, AlertTriangle, Loader2, Check } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

type ParsedProduct = {
  productId?: string;
  title: string;
  article?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  images: string[];
  primaryImage?: string | null;
  similar: { title?: string; price?: number; image?: string }[];
  sizes: string[];
  recommendedSize?: string;
  recommendationConfidence?: number;
  fitNotes?: string[];
  marketplace?: string;
};

export default function TryOnPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialUrl = (location.state as { url?: string } | null)?.url ?? searchParams.get('url') ?? '';

  const [activeTab, setActiveTab] = useState<'2d' | '3d'>('2d');
  const [is2DModalOpen, setIs2DModalOpen] = useState(false);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState('M');
  const [product, setProduct] = useState<ParsedProduct | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [sizeRecommendation, setSizeRecommendation] = useState<{
    size: string;
    confidence?: number;
    source?: string;
    tips?: string[];
  } | null>(null);
  const [tryOnPreview, setTryOnPreview] = useState<{ mode: '2d' | '3d'; image?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (value?: number) =>
    typeof value === 'number' ? value.toLocaleString('ru-RU') : undefined;

  const normalizeProductResponse = (data: any): ParsedProduct => {
    const price = Number(data?.price?.current ?? data?.price ?? data?.pricing?.price);
    const originalPrice = Number(
      data?.price?.original ?? data?.pricing?.original ?? data?.price?.base ?? undefined
    );
    const discount =
      data?.discount ??
      data?.price?.discount ??
      (price && originalPrice ? Math.round((1 - price / originalPrice) * 100) : undefined);
    const images = data?.media?.images ?? data?.images ?? data?.gallery ?? [];
    const similar = data?.similar ?? data?.recommendations ?? data?.similarProducts ?? [];
    const sizes = data?.size_chart?.sizes ?? data?.sizes ?? data?.sizeChart?.sizes ?? [];
    const recommendedSize = data?.recommendation?.size ?? data?.sizeRecommendation?.size ?? data?.recommendedSize;
    const recommendationConfidence =
      data?.recommendation?.confidence ?? data?.sizeRecommendation?.confidence ?? data?.recommendationConfidence;

    return {
      productId: data?.productId ?? data?.id,
      title: data?.title ?? data?.name ?? 'Товар',
      article: data?.article ?? data?.sku ?? data?.vendorCode,
      price: Number.isFinite(price) ? price : undefined,
      originalPrice: Number.isFinite(originalPrice) ? originalPrice : undefined,
      discount: Number.isFinite(discount) ? discount : undefined,
      images: Array.isArray(images) ? images : [],
      primaryImage: data?.primaryImage ?? (Array.isArray(images) ? images[0] : null),
      similar: Array.isArray(similar) ? similar : [],
      sizes: Array.isArray(sizes) ? sizes.map(String) : [],
      recommendedSize,
      recommendationConfidence,
      fitNotes: data?.recommendation?.notes ?? data?.fitNotes ?? [],
      marketplace: data?.marketplace ?? data?.source,
    };
  };

  useEffect(() => {
    if (!initialUrl) {
      setError('Ссылка на товар не передана. Вернитесь на главную и вставьте URL.');
      return;
    }

    try {
      new URL(initialUrl);
    } catch {
      setError('Некорректный URL. Проверьте ссылку с маркетплейса.');
      return;
    }

    const controller = new AbortController();

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/product/parse?url=${encodeURIComponent(initialUrl)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Маркетплейс недоступен или ссылка не поддерживается.');
        }

        const data = await response.json();
        const parsed = normalizeProductResponse(data);

        setProduct(parsed);
        setSelectedImageIndex(0);

        if (parsed.recommendedSize) {
          setSelectedSize(parsed.recommendedSize);
          setSizeRecommendation({
            size: parsed.recommendedSize,
            confidence: parsed.recommendationConfidence,
            source: 'HEX AI',
            tips: parsed.fitNotes,
          });
        } else if (parsed.sizes?.length) {
          setSelectedSize(parsed.sizes[0]);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setProduct(null);
        setError(err?.message || 'Не удалось загрузить данные товара.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();

    return () => controller.abort();
  }, [initialUrl]);

  useEffect(() => {
    if (!actionMessage) return;

    const timer = setTimeout(() => setActionMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  const productImages = useMemo(() => product?.images?.filter(Boolean) ?? [], [product]);
  const availableSizes = useMemo(() => product?.sizes?.length ? product.sizes : ['XS', 'S', 'M', 'L', 'XL'], [product]);

  const previewImage = useMemo(() => {
    if (activeTab === '2d' && tryOnPreview?.mode === '2d' && tryOnPreview.image) return tryOnPreview.image;
    if (activeTab === '3d' && tryOnPreview?.mode === '3d' && tryOnPreview.image) return tryOnPreview.image;

    return productImages[selectedImageIndex] ??
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=80';
  }, [activeTab, productImages, selectedImageIndex, tryOnPreview]);

  const handleTryOnComplete = (result: { mode: '2d' | '3d'; image?: string; recommendedSize?: string; confidence?: number }) => {
    if (result.image) {
      setTryOnPreview({ mode: result.mode, image: result.image });
    }

    const nextSize = result.recommendedSize ?? product?.recommendedSize ?? selectedSize;
    if (nextSize) {
      setSelectedSize(nextSize);
      setSizeRecommendation({
        size: nextSize,
        confidence: result.confidence ?? product?.recommendationConfidence,
        source: result.mode === '2d' ? '2D примерка' : '3D подбор',
        tips: product?.fitNotes,
      });
    }

    if (result.mode === '2d') {
      setIs2DModalOpen(false);
    } else {
      setIs3DModalOpen(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = initialUrl || window.location.href;
    const shareData = {
      title: product?.title ?? 'HEX AI Try-On',
      text: 'Посмотри, какой образ я примеряю!',
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setActionMessage('Ссылка отправлена через системное меню.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setActionMessage('Ссылка скопирована в буфер обмена.');
      } else {
        setActionMessage(`Скопируйте ссылку: ${shareUrl}`);
      }
    } catch {
      setActionMessage('Не удалось поделиться ссылкой.');
    }
  };

  const handleToggleFavorite = () => {
    setIsFavorite((prev) => !prev);
    setActionMessage(!isFavorite ? 'Добавлено в избранное.' : 'Удалено из избранного.');
  };

  return (
    <Layout>
      {actionMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 right-6 z-20 bg-white shadow-xl border border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold text-hex-dark"
        >
          {actionMessage}
        </motion.div>
      )}
      <div className="container mx-auto px-6 py-8 lg:py-12">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-hex-gray hover:text-hex-primary transition-colors font-medium">
            <ArrowLeft size={20} className="mr-2" />
            Вернуться назад
          </Link>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-5 flex items-start gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-semibold">{error}</p>
              <p className="text-sm mt-1 text-red-600">Попробуйте другую ссылку или повторите попытку позже.</p>
            </div>
          </div>
        )}

        {!error && (
          <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs uppercase text-gray-400 font-semibold">Товар</p>
              <p className="text-sm font-medium text-hex-dark break-all">{initialUrl}</p>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-hex-primary">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}<span>{loading ? 'Загружаем...' : 'Готово'}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-12 h-auto lg:h-[calc(100vh-12rem)] min-h-[700px]">
          
          {/* Left Column - Preview */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-[60%] flex flex-col gap-6"
          >
            {/* Tabs */}
            <div className="flex p-1.5 bg-white rounded-2xl w-fit shadow-sm border border-gray-100">
              <button
                onClick={() => setActiveTab('2d')}
                className={clsx(
                  "px-8 py-3 rounded-xl text-sm font-bold transition-all",
                  activeTab === '2d' 
                    ? "bg-hex-dark text-white shadow-lg" 
                    : "text-hex-gray hover:text-hex-dark hover:bg-gray-50"
                )}
              >
                2D примерка
              </button>
              <button
                onClick={() => setActiveTab('3d')}
                className={clsx(
                  "px-8 py-3 rounded-xl text-sm font-bold transition-all",
                  activeTab === '3d' 
                    ? "bg-hex-dark text-white shadow-lg" 
                    : "text-hex-gray hover:text-hex-dark hover:bg-gray-50"
                )}
              >
                3D-аватар
              </button>
            </div>

            {/* Main Preview Area */}
            <div className="flex-grow bg-white rounded-[2.5rem] shadow-card overflow-hidden relative group border border-gray-100">
              <img
                src={previewImage}
                alt={product?.title || 'Try On Preview'}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {loading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-hex-primary animate-spin" />
                </div>
              )}

              {/* Overlay Controls */}
              <div
                className="absolute bottom-6 left-6 right-6 flex justify-between items-end gap-3 rounded-3xl px-3 py-3 bg-gradient-to-t from-black/10 via-black/0 to-transparent transition-all duration-300 opacity-100 translate-y-0 md:opacity-0 md:translate-y-4 md:group-hover:opacity-100 md:group-hover:translate-y-0"
              >
                <div className="flex gap-3">
                  <button
                    onClick={handleShare}
                    className="p-4 bg-white/90 backdrop-blur-md rounded-2xl hover:bg-white transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300"
                    aria-label="Поделиться"
                  >
                    <Share2 size={22} className="text-hex-dark" />
                  </button>
                  <button
                    onClick={handleToggleFavorite}
                    className={clsx(
                      'p-4 bg-white/90 backdrop-blur-md rounded-2xl transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300 border',
                      isFavorite
                        ? 'bg-hex-primary/10 border-hex-primary/40'
                        : 'hover:bg-white border-transparent'
                    )}
                    aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                  >
                    <Heart size={22} className={clsx('text-hex-dark', isFavorite && 'fill-hex-primary text-hex-primary')} />
                  </button>
                </div>
                <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border border-white/50">
                  <span className="text-sm font-bold text-hex-dark">Фон: Студия (светлый)</span>
                </div>
              </div>
            </div>

            {/* Thumbnails */}
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {(productImages.length ? productImages : [previewImage]).map((src, index) => (
                <button
                  key={src + index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={clsx(
                    "w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all hover:-translate-y-1 shadow-sm hover:shadow-md flex-shrink-0",
                    selectedImageIndex === index ? 'border-hex-primary' : 'border-transparent hover:border-hex-primary'
                  )}
                >
                  <img
                    src={src}
                    alt={`Variant ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Info & Controls */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full lg:w-[40%] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar"
          >
            {/* Product Info */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-gray-100">
              <div className="flex justify-between items-start mb-6 gap-4">
                <div>
                  <h1 className="text-3xl font-extrabold text-hex-dark mb-2 leading-tight">
                    {product?.title ?? 'Загружаем товар...'}
                  </h1>
                  <p className="text-hex-gray font-medium">
                    {product?.article ? `Артикул: ${product.article}` : 'Артикул уточняется'}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-3xl font-bold text-hex-primary block">
                    {product?.price ? `${formatPrice(product.price)} ₽` : '—'}
                  </span>
                  {product?.originalPrice && (
                    <span className="text-base text-gray-400 line-through font-medium">
                      {formatPrice(product.originalPrice)} ₽
                    </span>
                  )}
                  {product?.discount && (
                    <Badge className="bg-hex-primary/10 text-hex-primary border border-hex-primary/30">
                      -{product.discount}%
                    </Badge>
                  )}
                </div>
              </div>

              {/* Sizes */}
              <div className="mb-8">
                <div className="flex justify-between mb-4 items-center">
                  <span className="text-base font-bold text-hex-dark">Выберите размер</span>
                  <span className="text-sm text-hex-primary font-semibold">
                    {product?.marketplace ?? 'Маркетплейс'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      disabled={loading}
                      className={clsx(
                        "w-14 h-14 rounded-2xl font-bold text-lg transition-all flex items-center justify-center relative",
                        selectedSize === size
                          ? "bg-hex-dark text-white shadow-lg scale-105"
                          : "bg-gray-50 text-hex-dark hover:bg-gray-100 hover:scale-105",
                        loading && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      {size}
                      {sizeRecommendation?.size === size && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </span>
                      )}
                    </button>
                  ))}
                  {!availableSizes.length && (
                    <span className="text-sm text-hex-gray">Размерная сетка недоступна</span>
                  )}
                </div>
              </div>

              {/* HEX AI Actions */}
              <div className="bg-hex-bg rounded-3xl p-6 mb-8 border border-hex-primary/5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 bg-hex-primary rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-hex-primary/30">X</div>
                  <span className="font-extrabold text-hex-primary tracking-wide">HEX AI TRY-ON</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIs2DModalOpen(true)}
                    className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-lg transition-all text-left group border border-transparent hover:border-hex-primary/20"
                  >
                    <div className="w-12 h-12 bg-hex-primary/10 rounded-2xl flex items-center justify-center mb-4 text-hex-primary group-hover:scale-110 transition-transform duration-300">
                      <Camera size={24} />
                    </div>
                    <div className="font-bold text-hex-dark text-base mb-1">2D Примерка</div>
                    <div className="text-xs font-medium text-hex-gray">По вашему фото</div>
                  </button>

                  <button 
                    onClick={() => setIs3DModalOpen(true)}
                    className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-lg transition-all text-left group border border-transparent hover:border-hex-primary/20"
                  >
                    <div className="w-12 h-12 bg-hex-primary/10 rounded-2xl flex items-center justify-center mb-4 text-hex-primary group-hover:scale-110 transition-transform duration-300">
                      <Box size={24} />
                    </div>
                    <div className="font-bold text-hex-dark text-base mb-1">3D Подбор</div>
                    <div className="text-xs font-medium text-hex-gray">По параметрам</div>
                  </button>
                </div>
              </div>

              {/* AI Recommendation */}
              <div className="border border-green-100 bg-green-50/50 rounded-3xl p-6 mb-8">
                {sizeRecommendation ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <Badge variant="success" className="px-3 py-1 text-sm">
                        Рекомендуем {sizeRecommendation.size}
                      </Badge>
                      {sizeRecommendation.confidence && (
                        <span className="text-sm text-green-700 font-bold">
                          {Math.round(
                            (sizeRecommendation.confidence <= 1
                              ? sizeRecommendation.confidence * 100
                              : sizeRecommendation.confidence)
                          )}% совпадение
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-hex-gray mb-4 font-medium leading-relaxed">
                      {sizeRecommendation.source
                        ? `Размер подобран на основе ${sizeRecommendation.source}.`
                        : 'AI подобрал размер на основе ваших действий.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(sizeRecommendation.tips?.length ? sizeRecommendation.tips : ['По груди', 'По талии', 'По длине']).map((label) => (
                        <span key={label} className="text-[11px] font-semibold px-3 py-1.5 bg-white rounded-lg text-gray-500 border border-gray-100 shadow-sm">
                          {label}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3 text-hex-gray">
                    <Sparkles className="w-5 h-5 text-hex-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-hex-dark">Запустите 2D или 3D примерку</p>
                      <p className="text-sm">После примерки мы покажем рекомендуемый размер и подсказки по посадке.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="space-y-4">
                <Button size="lg" className="w-full justify-between group text-lg py-5 shadow-violet-500/20">
                  <span>Добавить в корзину</span>
                  <span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-semibold backdrop-blur-sm">
                    {product?.marketplace ?? 'Маркетплейс'}
                  </span>
                </Button>
                <Button variant="secondary" className="w-full py-5 text-lg font-semibold">
                  Сохранить образ
                </Button>
              </div>
            </div>

            {/* Similar Items */}
            <div>
              <h3 className="font-bold text-hex-dark mb-5 text-xl">Похожие образы</h3>
              {product?.similar?.length ? (
                <div className="grid grid-cols-2 gap-5">
                  {product.similar.map((item, index) => (
                    <div key={(item.title ?? '') + index} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-center cursor-pointer hover:border-hex-primary/30 hover:shadow-md transition-all group">
                      <img
                        src={item.image ?? productImages[index % (productImages.length || 1)] ?? previewImage}
                        alt={item.title ?? 'Similar'}
                        className="w-20 h-24 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                      />
                      <div>
                        <div className="text-sm font-bold text-hex-dark mb-1 group-hover:text-hex-primary transition-colors">
                          {item.title ?? `Образ ${index + 1}`}
                        </div>
                        {item.price && (
                          <div className="text-sm text-hex-primary font-extrabold">{formatPrice(item.price)} ₽</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-hex-gray">Мы покажем похожие образы после загрузки товара.</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <TryOn2DModal
        isOpen={is2DModalOpen}
        onClose={() => setIs2DModalOpen(false)}
        suggestedSize={sizeRecommendation?.size ?? product?.recommendedSize ?? selectedSize}
        suggestedConfidence={sizeRecommendation?.confidence ?? product?.recommendationConfidence}
        garmentImageUrl={productImages[selectedImageIndex] ?? product?.primaryImage ?? undefined}
        productId={product?.productId}
        onComplete={({ image, recommendedSize, confidence }) =>
          handleTryOnComplete({ mode: '2d', image, recommendedSize, confidence })
        }
      />

      <TryOn3DModal
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        suggestedSize={sizeRecommendation?.size ?? product?.recommendedSize ?? selectedSize}
        suggestedConfidence={sizeRecommendation?.confidence ?? product?.recommendationConfidence}
        onComplete={({ recommendedSize, confidence }) =>
          handleTryOnComplete({ mode: '3d', recommendedSize, confidence })
        }
      />
    </Layout>
  );
}

function Check({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
