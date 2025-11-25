import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { TryOn2DModal } from '../components/TryOn2DModal';
import { TryOn3DModal } from '../components/TryOn3DModal';
import { Camera, Box, ShoppingBag, Heart, Share2, Sparkles, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function TryOnPage() {
  const [activeTab, setActiveTab] = useState<'2d' | '3d'>('2d');
  const [is2DModalOpen, setIs2DModalOpen] = useState(false);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState('M');

  return (
    <Layout>
      <div className="container mx-auto px-6 py-8 lg:py-12">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-hex-gray hover:text-hex-primary transition-colors font-medium">
            <ArrowLeft size={20} className="mr-2" />
            Вернуться назад
          </Link>
        </div>

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
                src={activeTab === '2d' 
                  ? "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=80" 
                  : "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=1200&q=80"
                }
                alt="Try On Preview" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Overlay Controls */}
              <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0">
                <div className="flex gap-3">
                  <button className="p-4 bg-white/90 backdrop-blur-md rounded-2xl hover:bg-white transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300">
                    <Share2 size={22} className="text-hex-dark" />
                  </button>
                  <button className="p-4 bg-white/90 backdrop-blur-md rounded-2xl hover:bg-white transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300">
                    <Heart size={22} className="text-hex-dark" />
                  </button>
                </div>
                <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border border-white/50">
                  <span className="text-sm font-bold text-hex-dark">Фон: Студия (светлый)</span>
                </div>
              </div>
            </div>

            {/* Thumbnails */}
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2, 3].map((i) => (
                <button key={i} className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-transparent hover:border-hex-primary transition-all hover:-translate-y-1 shadow-sm hover:shadow-md flex-shrink-0">
                  <img 
                    src={`https://images.unsplash.com/photo-${1500000000000 + i}?w=200&q=80`} 
                    alt={`Variant ${i}`}
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
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-extrabold text-hex-dark mb-2 leading-tight">Платье миди с цветочным принтом</h1>
                  <p className="text-hex-gray font-medium">Артикул: 12345678</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-hex-primary block">3 490 ₽</span>
                  <span className="text-base text-gray-400 line-through font-medium">4 990 ₽</span>
                </div>
              </div>

              {/* Sizes */}
              <div className="mb-8">
                <div className="flex justify-between mb-4">
                  <span className="text-base font-bold text-hex-dark">Выберите размер</span>
                  <a href="#" className="text-sm text-hex-primary font-semibold hover:underline">Таблица размеров</a>
                </div>
                <div className="flex flex-wrap gap-3">
                  {['XS', 'S', 'M', 'L', 'XL'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={clsx(
                        "w-14 h-14 rounded-2xl font-bold text-lg transition-all flex items-center justify-center relative",
                        selectedSize === size
                          ? "bg-hex-dark text-white shadow-lg scale-105"
                          : "bg-gray-50 text-hex-dark hover:bg-gray-100 hover:scale-105"
                      )}
                    >
                      {size}
                      {size === 'M' && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </span>
                      )}
                    </button>
                  ))}
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
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="success" className="px-3 py-1 text-sm">Рекомендуем M</Badge>
                  <span className="text-sm text-green-700 font-bold">98% совпадение</span>
                </div>
                <p className="text-sm text-hex-gray mb-4 font-medium leading-relaxed">
                  По вашим параметрам и отзывам похожих пользователей, этот размер сядет идеально.
                </p>
                <div className="flex gap-2">
                  {['По груди', 'По талии', 'По длине'].map((label) => (
                    <span key={label} className="text-[11px] font-semibold px-3 py-1.5 bg-white rounded-lg text-gray-500 border border-gray-100 shadow-sm">
                      {label}: ok
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="space-y-4">
                <Button size="lg" className="w-full justify-between group text-lg py-5 shadow-violet-500/20">
                  <span>Добавить в корзину</span>
                  <span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-semibold backdrop-blur-sm">Wildberries</span>
                </Button>
                <Button variant="secondary" className="w-full py-5 text-lg font-semibold">
                  Сохранить образ
                </Button>
              </div>
            </div>

            {/* Similar Items */}
            <div>
              <h3 className="font-bold text-hex-dark mb-5 text-xl">Похожие образы</h3>
              <div className="grid grid-cols-2 gap-5">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-center cursor-pointer hover:border-hex-primary/30 hover:shadow-md transition-all group">
                    <img 
                      src={`https://images.unsplash.com/photo-${1500000000000 + i}?w=100&q=80`} 
                      alt="Similar" 
                      className="w-20 h-24 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                    />
                    <div>
                      <div className="text-sm font-bold text-hex-dark mb-1 group-hover:text-hex-primary transition-colors">Блузка</div>
                      <div className="text-sm text-hex-primary font-extrabold">2 100 ₽</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <TryOn2DModal 
        isOpen={is2DModalOpen} 
        onClose={() => setIs2DModalOpen(false)} 
        onComplete={() => setIs2DModalOpen(false)} 
      />
      
      <TryOn3DModal 
        isOpen={is3DModalOpen} 
        onClose={() => setIs3DModalOpen(false)} 
        onComplete={() => setIs3DModalOpen(false)} 
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
