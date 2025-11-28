import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Layout } from '../components/Layout';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Как работает виртуальная примерка HEX?',
    answer:
      'Мы создаем персонализированную 3D-модель по вашему фото и параметрам, затем симулируем посадку выбранной вещи с учетом ткани и кроя.',
  },
  {
    question: 'Нужно ли загружать своё фото каждый раз?',
    answer:
      'Нет, вы можете сохранить образ в профиле и использовать его для повторных примерок. Фото можно обновлять, чтобы получать максимально точные рекомендации.',
  },
  {
    question: 'Какие магазины поддерживаются?',
    answer:
      'Сейчас мы работаем с Wildberries, Ozon и Lamoda. Новые площадки появляются регулярно — следите за обновлениями.',
  },
  {
    question: 'Безопасно ли делиться своими данными?',
    answer:
      'Все фото обрабатываются в защищённой среде и автоматически удаляются после формирования 3D-модели. Мы не передаём данные третьим сторонам.',
  },
  {
    question: 'Насколько точны рекомендации по размеру?',
    answer:
      'Алгоритм обучен на миллионах посадок и постоянно улучшает точность. Мы указываем уверенность прогноза, чтобы вы могли принять осознанное решение.',
  },
  {
    question: 'Можно ли примерить несколько образов сразу?',
    answer:
      'Да, добавляйте несколько товаров в очередь примерки и сравнивайте результаты в одном окне, чтобы выбрать лучший вариант.',
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleIndex = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <Layout>
      <section
        id="faq"
        className="relative pt-28 pb-32 lg:pt-32 lg:pb-40 bg-white overflow-hidden scroll-mt-32"
      >
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:40px_40px] opacity-30"></div>
        <div className="absolute -top-32 -left-24 w-96 h-96 bg-hex-secondary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] bg-hex-primary/10 rounded-full blur-3xl"></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-14 lg:mb-16">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center px-4 py-2 rounded-full bg-hex-primary/10 border border-hex-primary/20 text-hex-primary font-semibold tracking-wide shadow-glow"
            >
              FAQ
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl lg:text-5xl font-extrabold text-hex-dark mt-6 mb-4"
            >
              Отвечаем на популярные вопросы
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg lg:text-xl text-hex-gray leading-relaxed"
            >
              Узнайте, как быстрее примерить товары, как мы защищаем данные и как получить максимально точные рекомендации по размеру.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-hex-primary/10 via-white to-hex-secondary/10 border border-white/80 shadow-2xl shadow-hex-primary/10 mb-10 lg:mb-14"
          >
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_left,#a78bfa_0,transparent_45%)]" />
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_bottom_right,#22d3ee_0,transparent_45%)]" />
            <div className="relative p-8 lg:p-12 grid md:grid-cols-[1.2fr_1fr] gap-8 lg:gap-12 items-center">
              <div className="space-y-4">
                <p className="inline-flex items-center px-4 py-2 rounded-full bg-white/70 border border-hex-primary/20 text-hex-primary font-semibold tracking-wide shadow-glow">
                  УТП HEX
                </p>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-hex-dark leading-tight">
                  HEX сокращает возвраты и даёт уверенность в каждой покупке одежды онлайн.
                </h2>
                <p className="text-lg lg:text-xl text-hex-gray leading-relaxed">
                  Персонализированная 3D-примерка анализирует ткань, крой и ваши параметры, чтобы сразу показать посадку и подсказать точный размер.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {["99% персонализации", "-35% возвратов", "5 сек на первую примерку"].map((metric) => (
                  <div
                    key={metric}
                    className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white/70 shadow-card px-4 py-5 text-center"
                  >
                    <p className="text-sm font-semibold text-hex-primary uppercase tracking-wide">Результат</p>
                    <p className="mt-2 text-lg font-bold text-hex-dark leading-tight">{metric}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {faqs.map((item, index) => {
              const isOpen = openIndex === index;
              const contentId = `faq-panel-${index}`;

              return (
                <motion.div
                  key={item.question}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="group bg-gradient-to-br from-white via-white to-hex-bg border border-white/70 rounded-[1.75rem] shadow-card hover:shadow-2xl transition-all duration-500 overflow-hidden relative"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-hex-primary via-violet-400 to-hex-secondary opacity-80"></div>
                  <button
                    type="button"
                    className="w-full text-left px-8 py-6 lg:px-10 lg:py-7 flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-hex-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => toggleIndex(index)}
                  >
                    <div>
                      <p className="text-sm font-semibold text-hex-primary uppercase tracking-wide mb-2">Вопрос {index + 1}</p>
                      <h3 className="text-2xl font-bold text-hex-dark leading-tight">{item.question}</h3>
                    </div>
                    <div
                      className={`flex items-center justify-center w-11 h-11 rounded-full bg-white shadow-inner border border-gray-100 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden={true}
                    >
                      <ChevronDown className="text-hex-dark" />
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        id={contentId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="px-8 pb-8 lg:px-10 lg:pb-10"
                      >
                        <p className="text-lg text-hex-gray leading-relaxed">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
}
