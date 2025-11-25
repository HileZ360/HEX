import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Clipboard, ArrowRight, Shirt, Camera, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import clsx from 'clsx';

export default function HomePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);

  const handleTryOn = () => {
    const trimmed = url.trim();

    if (!trimmed) {
      setError('Введите ссылку на товар');
      return;
    }

    try {
      const normalized = new URL(trimmed).toString();
      setError(null);
      navigate(`/try-on?url=${encodeURIComponent(normalized)}`, { state: { url: normalized } });
    } catch (err) {
      console.error('Invalid URL', err);
      setError('Некорректный URL. Проверьте ссылку на маркетплейс.');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-40 overflow-hidden">
        {/* Animated Background Blobs */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -z-10 top-[-10%] left-[-10%] w-[800px] h-[800px] bg-hex-secondary/20 rounded-full blur-[120px] opacity-50"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, -60, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -z-10 bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-orange-100/40 rounded-full blur-[100px] opacity-50"
        />

        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
            
            {/* Left Content - Illustration */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="w-full lg:w-1/2 order-2 lg:order-1 relative perspective-1000"
            >
              <motion.div 
                style={{ y: y1 }}
                className="relative aspect-[4/3] rounded-[2.5rem] overflow-hidden bg-white/50 backdrop-blur-sm shadow-2xl shadow-violet-500/10 border border-white/50 p-8"
              >
                {/* Composition */}
                <div className="absolute inset-0 bg-gradient-to-br from-hex-accent/50 to-white/50 flex items-center justify-center">
                   {/* Back Card */}
                   <motion.div 
                     animate={{ rotate: -6, y: [0, -15, 0] }}
                     transition={{ rotate: { duration: 0 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
                     className="relative w-64 h-80 bg-white rounded-3xl overflow-hidden shadow-card transform -rotate-6 border border-gray-100 group hover:scale-105 transition-transform duration-500"
                   >
                      <img 
                        src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80" 
                        alt="Model" 
                        className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-hex-primary/5 mix-blend-overlay"></div>
                   </motion.div>
                   
                   {/* Front Card */}
                   <motion.div 
                     animate={{ rotate: 6, y: [0, -20, 0] }}
                     transition={{ rotate: { duration: 0 }, y: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 } }}
                     className="absolute w-64 h-80 bg-white rounded-3xl overflow-hidden shadow-2xl transform rotate-6 translate-x-16 translate-y-8 border-4 border-white group hover:scale-105 transition-transform duration-500"
                   >
                      <img 
                        src="https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=800&q=80" 
                        alt="Virtual Try On Result" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-white/50">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 animate-pulse">
                            <CheckCircle2 size={14} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-hex-dark">Размер M</div>
                            <div className="text-[10px] font-medium text-hex-gray">Идеальная посадка</div>
                          </div>
                        </div>
                      </div>
                   </motion.div>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Content - Action */}
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="w-full lg:w-1/2 order-1 lg:order-2 z-10"
            >
              <motion.div variants={itemVariants}>
                <span className="inline-block px-4 py-1.5 rounded-full bg-hex-primary/10 text-hex-primary font-bold text-sm mb-6 tracking-wide border border-hex-primary/20 shadow-glow">
                  AI VIRTUAL TRY-ON 2.0
                </span>
              </motion.div>
              
              <motion.h1 variants={itemVariants} className="text-5xl lg:text-7xl font-extrabold text-hex-dark mb-8 leading-[1.1] tracking-tight">
                Примерьте <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-hex-primary via-violet-500 to-hex-secondary animate-gradient-x">будущее моды</span>
              </motion.h1>
              
              <motion.p variants={itemVariants} className="text-xl text-hex-gray mb-10 max-w-lg leading-relaxed font-medium">
                Загрузите фото или вставьте ссылку с маркетплейса. 
                Наш AI подберет идеальный размер и покажет, как сидит вещь.
              </motion.p>

              <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-card border border-white/50 max-w-xl relative overflow-hidden group hover:shadow-2xl transition-shadow duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-hex-primary via-violet-400 to-hex-secondary"></div>
                <div className="flex flex-col gap-5">
                  <div className="relative">
                    <Input 
                      placeholder="Вставьте ссылку на товар (WB, Ozon)"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (error) setError(null);
                      }}
                      className="pr-14 bg-white/50 border-gray-200 focus:bg-white transition-all duration-300"
                      rightElement={
                        <button 
                          onClick={handlePaste}
                          className="p-2.5 text-hex-primary hover:bg-hex-primary/10 rounded-xl transition-colors active:scale-90"
                          title="Вставить из буфера"
                        >
                          <Clipboard size={20} />
                        </button>
                      }
                    />
                  </div>
                  <Button size="lg" onClick={handleTryOn} className="w-full group text-lg shadow-violet-500/30">
                    Перейти к примерке
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  {error && (
                    <div className="text-sm text-red-500 font-semibold text-center">{error}</div>
                  )}
                </div>
                
                <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
                  <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Работает с</span>
                  <div className="flex gap-3">
                    {['Wildberries', 'Ozon', 'Lamoda'].map((market) => (
                      <span key={market} className="px-4 py-1.5 bg-gray-50 rounded-full text-gray-600 text-sm font-semibold hover:bg-gray-100 transition-colors cursor-default hover:scale-105 transform duration-200">
                        {market}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 bg-white relative overflow-hidden" id="how-it-works">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:40px_40px] opacity-30"></div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl lg:text-5xl font-extrabold text-hex-dark mb-6"
            >
              Как работает HEX
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-xl text-hex-gray max-w-2xl mx-auto"
            >
              Технология компьютерного зрения для идеального шопинга
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                icon: <Shirt className="w-10 h-10 text-white" />,
                title: "Вставьте ссылку",
                desc: "Скопируйте ссылку на понравившийся товар с любого популярного маркетплейса",
                color: "bg-blue-500",
                shadow: "shadow-blue-500/30"
              },
              {
                icon: <Camera className="w-10 h-10 text-white" />,
                title: "Загрузите фото",
                desc: "Или введите свои параметры для создания точного 3D-аватара вашего тела",
                color: "bg-hex-primary",
                shadow: "shadow-violet-500/30"
              },
              {
                icon: <Sparkles className="w-10 h-10 text-white" />,
                title: "Получите результат",
                desc: "Увидите, как сидит вещь, и узнаете точный размер с рекомендациями по посадке",
                color: "bg-orange-500",
                shadow: "shadow-orange-500/30"
              }
            ].map((step, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 50, rotateX: -10 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, type: "spring", stiffness: 100 }}
                whileHover={{ y: -15, rotateX: 5, scale: 1.02 }}
                className="group bg-hex-bg p-10 rounded-[2.5rem] hover:bg-white hover:shadow-2xl transition-all duration-500 border border-transparent hover:border-gray-100 relative overflow-hidden"
              >
                <div className={clsx("w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500", step.color, step.shadow)}>
                  {step.icon}
                </div>
                <h3 className="text-2xl font-bold text-hex-dark mb-4 group-hover:text-hex-primary transition-colors">{step.title}</h3>
                <p className="text-hex-gray leading-relaxed text-lg">
                  {step.desc}
                </p>
                
                {/* Decorative gradient blob on hover */}
                <div className={clsx("absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none", step.color)}></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
