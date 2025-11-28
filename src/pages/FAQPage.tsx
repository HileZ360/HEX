import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  PlugZap,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
  accent?: 'primary' | 'secondary';
};

const accordionAnimation = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.25, ease: 'easeInOut' },
};

function FAQCard({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white/80 backdrop-blur-xl border border-white/70 shadow-card rounded-3xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${item.id}`}
        id={`faq-trigger-${item.id}`}
        className="w-full flex items-start justify-between gap-6 text-left"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-glow text-white ${
                item.accent === 'secondary'
                  ? 'bg-gradient-to-br from-orange-400 to-hex-secondary'
                  : 'bg-gradient-to-br from-hex-primary to-violet-500'
              }`}
            >
              <Sparkles size={18} />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-hex-dark">{item.question}</h3>
          </div>
          <p className="text-sm text-hex-gray font-medium">Раскройте, чтобы узнать подробности</p>
        </div>

        <div
          className={`mt-1 shrink-0 rounded-full border border-gray-200 p-2 transition-transform duration-300 bg-white/60 ${
            isOpen ? 'rotate-180 shadow-inner' : ''
          }`}
          aria-hidden
        >
          <ChevronDown className="w-5 h-5 text-hex-gray" />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-panel-${item.id}`}
            role="region"
            aria-labelledby={`faq-trigger-${item.id}`}
            {...accordionAnimation}
            className="overflow-hidden"
          >
            <div className="pt-4 md:pt-6 text-base text-hex-gray leading-relaxed border-t border-gray-100">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQPage() {
  const faqItems: FAQItem[] = [
    {
      id: 'how-works',
      question: 'Как работает виртуальная примерка HEX?',
      answer:
        'Мы парсим карточку товара, прогнозируем посадку по вашим меркам и показываем 2D/3D превью. Алгоритм обучен на данных маркетплейсов и комбинирует сегментацию тела с симуляцией ткани.',
    },
    {
      id: 'accuracy',
      question: 'Насколько точен подбор размера?',
      answer:
        'Мы сверяемся с реальными сетками брендов, учитываем пропорции пользователя и возвращаем рекомендации с пояснением. На популярных категориях (hoodie, футболки, джинсы) точность подбора достигает 92–95%.',
      accent: 'secondary',
    },
    {
      id: 'photo',
      question: 'Что нужно от пользователя для примерки?',
      answer:
        'Достаточно ссылки на товар и одной фотографии в полный рост или селфи с нейтральным фоном. Можно начать без фото — покажем размер и подгрузим визуал после загрузки снимка.',
    },
    {
      id: 'integration',
      question: 'Как подключить HEX к моему магазину?',
      answer:
        'Используйте готовый виджет или API: запускайте `npm run server` для локального Fastify API на порту 4000 и укажите TRY_ON_API_URL/TRY_ON_API_TOKEN в .env. Парсинг товаров доступен по /api/product/parse, примерка по маршрутам /api/tryon.',
      accent: 'secondary',
    },
    {
      id: 'api-source',
      question: 'Откуда брать API для проекта?',
      answer:
        'API уже входит в репозиторий: в каталоге server лежит Fastify-сервис с провайдерами try-on. Поднимите его командой `npm run server`, дополните переменные окружения (TRY_ON_API_URL, TRY_ON_3D_API_URL, TRY_ON_API_TOKEN) и обращайтесь к эндпоинтам /api/tryon и /api/product/parse.',
    },
    {
      id: 'privacy',
      question: 'Как обеспечивается приватность данных?',
      answer:
        'Фото не хранятся дольше заданного TTL: превью удаляются по расписанию, токены подписываются HMAC-ключом, а входящие запросы ограничиваются rate limit, чтобы исключить злоупотребления.',
    },
  ];

  const navigate = useNavigate();

  return (
    <Layout>
      <section id="faq" className="relative pt-24 pb-28 overflow-hidden">
        <div className="absolute -z-10 inset-0 bg-[radial-gradient(circle_at_top,_#ede9fe_0,_transparent_45%),radial-gradient(circle_at_bottom,_#fef3c7_0,_transparent_40%)] opacity-70" />

        <div className="container mx-auto px-6 space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
          >
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-hex-primary/10 text-hex-primary font-semibold border border-hex-primary/20 shadow-glow">
                <Sparkles size={18} /> FAQ & УТП
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-hex-dark leading-tight">
                Ответы на частые вопросы и наше главное предложение ценности
              </h1>
              <p className="text-lg text-hex-gray leading-relaxed max-w-2xl">
                Мы собрали ключевые ответы и оформили предложение ценности, чтобы вы могли быстро встроить HEX в витрину или протестировать примерку локально.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => navigate('/try-on')}
                >
                  Запустить примерку
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    window.location.href = 'mailto:hello@hex.ai';
                  }}
                >
                  Связаться с командой
                  <Sparkles className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-hex-primary via-violet-500 to-hex-secondary text-white rounded-[28px] p-8 md:p-10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%)]" />
              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-12 h-12" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Уникальное торговое предложение</p>
                    <h2 className="text-2xl md:text-3xl font-bold">HEX: примерка за 30 секунд</h2>
                  </div>
                </div>
                <p className="text-lg text-white/90 leading-relaxed">
                  Конверсия выше, возвратов меньше: AI-подбор размера, 2D/3D визуализация и готовый API/виджет — без сложной интеграции.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[{
                    icon: <PlugZap className="w-5 h-5" />, label: 'Интеграция за 1 день',
                  }, {
                    icon: <Clock3 className="w-5 h-5" />, label: 'Примерка < 30 секунд',
                  }, {
                    icon: <ShieldCheck className="w-5 h-5" />, label: 'Безопасное хранение',
                  }, {
                    icon: <Sparkles className="w-5 h-5" />, label: 'Точные рекомендации',
                  }].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3 border border-white/10 shadow-inner">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">{item.icon}</div>
                      <span className="font-semibold text-white/90">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-2 text-sm text-white/80">
                  <CheckCircle2 className="w-4 h-4" />
                  Настраиваем UI под ваш бренд и выдаем SDK/документацию для API.
                </div>
              </div>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {faqItems.map((item) => (
              <FAQCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
