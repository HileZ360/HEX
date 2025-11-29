import { useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { AccountShell } from '../components/account/AccountShell';
import { StatCard } from '../components/account/StatCard';
import { TryOnHistory, TryOnItem } from '../components/account/TryOnHistory';
import {
  Bell,
  CalendarRange,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wand2
} from 'lucide-react';

const tryOnHistory: TryOnItem[] = [
  {
    id: 'TRY-4821',
    date: '09.01.2025',
    product: 'Двубортный костюм, графит',
    type: '3D',
    status: 'success',
    conversion: 82,
    sizeHint: '48R · уверенность 0.91'
  },
  {
    id: 'TRY-4812',
    date: '08.01.2025',
    product: 'Кашемировое пальто, темно-синее',
    type: '2D',
    status: 'pending',
    conversion: 62,
    sizeHint: '48 · уверенность 0.78'
  },
  {
    id: 'TRY-4799',
    date: '07.01.2025',
    product: 'Рубашка oxford slim',
    type: '2D',
    status: 'failed',
    conversion: 38,
    sizeHint: '39/182'
  },
  {
    id: 'TRY-4784',
    date: '05.01.2025',
    product: 'Трикотажный джемпер, антрацит',
    type: '3D',
    status: 'success',
    conversion: 79,
    sizeHint: '48 · уверенность 0.87'
  }
];

export default function AccountPage() {
  const conversionAverage = useMemo(() => {
    const sum = tryOnHistory.reduce((acc, item) => acc + item.conversion, 0);
    return Math.round(sum / tryOnHistory.length);
  }, []);

  return (
    <Layout>
      <section id="overview" className="container mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-semibold text-hex-primary mb-2">Личный кабинет</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-hex-dark">Привет, Новиков А. А.</h1>
            <p className="text-lg text-hex-gray mt-2">
              Следи за примерками, мерками и конверсией в одном месте
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Button variant="secondary" icon={<CalendarRange size={18} />}>
              Период
            </Button>
            <Button icon={<Sparkles size={18} />}>Запустить примерку</Button>
          </div>
        </div>

        <AccountShell>
          <section className="bg-white/80 backdrop-blur-md border border-gray-100 rounded-3xl shadow-lg shadow-violet-500/5 p-6 lg:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=420&auto=format&fit=crop&q=80"
                  alt="User avatar"
                  className="h-16 w-16 rounded-2xl object-cover shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-hex-dark">Новиков А. А.</h2>
                    <Badge variant="primary">Pro</Badge>
                  </div>
                  <p className="text-sm text-hex-gray">novikov.aa@hex.app</p>
                  <p className="text-sm text-hex-gray">+7 (916) 555-08-24</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" icon={<ShieldCheck size={18} />}>
                  Безопасность
                </Button>
                <Button variant="secondary" icon={<Bell size={18} />}>
                  Уведомления
                </Button>
                <Button icon={<Wand2 size={18} />}>Новый стиль</Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
              <StatCard
                label="Средняя конверсия"
                value={`${conversionAverage}%`}
                helper="% пользователей перешли к покупке после примерки"
                trend={{ value: '+4.2%', isPositive: true }}
                icon={<TrendingUp size={18} />}
              />
              <StatCard
                label="Всего примерок"
                value="284"
                helper="+36 за последнюю неделю"
                trend={{ value: '+14%', isPositive: true }}
                icon={<Sparkles size={18} />}
              />
              <StatCard
                label="Сохраненные луки"
                value="32"
                helper="Пользователи вернутся к ним позже"
                icon={<CheckCircle2 size={18} />}
              />
              <StatCard
                label="С высокой конверсией"
                value="18"
                helper="Клиенты, у которых >70% конверсия"
                trend={{ value: '+3', isPositive: true }}
                icon={<Flame size={18} />}
              />
            </div>
          </section>

          <div className="grid xl:grid-cols-[2fr_1.2fr] gap-6 lg:gap-8">
            <TryOnHistory items={tryOnHistory} />

            <section
              id="analytics"
              className="bg-white/80 backdrop-blur-md border border-gray-100 rounded-3xl shadow-lg shadow-violet-500/5 p-6 lg:p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-hex-primary mb-1">Аналитика</p>
                  <h3 className="text-2xl font-bold text-hex-dark">Конверсия и воронка</h3>
                </div>
                <Badge variant="neutral">Период: 7 дней</Badge>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Добавили в корзину', value: 74 },
                  { label: 'Оплачено', value: 61 },
                  { label: 'Возвраты', value: 4 }
                ].map((step) => (
                  <div key={step.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold text-hex-dark">
                      <span>{step.label}</span>
                      <span>{step.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-hex-bg overflow-hidden">
                      <div className="h-full bg-hex-primary" style={{ width: `${step.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-hex-bg border border-gray-100">
                <p className="text-sm font-semibold text-hex-dark mb-1">Рекомендации</p>
                <ul className="space-y-3 text-sm text-hex-gray list-disc list-inside">
                  <li>Усилить CTA в карточках товаров с высоким CTR примерок.</li>
                  <li>Включить 3D примерку для пуховиков — выше конверсия на 12%.</li>
                  <li>Сегментировать пуши по размерам — меньше ошибок и возвратов.</li>
                </ul>
              </div>
            </section>
          </div>

          <section
            id="profile"
            className="bg-white/80 backdrop-blur-md border border-gray-100 rounded-3xl shadow-lg shadow-violet-500/5 p-6 lg:p-8 space-y-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-hex-primary mb-1">Профиль</p>
                <h3 className="text-2xl font-bold text-hex-dark">Данные пользователя</h3>
                <p className="text-sm text-hex-gray mt-1">Редактируйте контакты и предпочтения.</p>
              </div>
              <Button variant="secondary">Сохранить</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Имя" defaultValue="Александр" placeholder="Имя" />
              <Input label="Фамилия" defaultValue="Новиков" placeholder="Фамилия" />
              <Input label="E-mail" defaultValue="novikov.aa@hex.app" type="email" />
              <Input label="Телефон" defaultValue="+7 (916) 555-08-24" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Язык интерфейса" defaultValue="Русский" />
              <Input label="Часовой пояс" defaultValue="GMT+3" />
            </div>
          </section>

          <section
            id="settings"
            className="bg-white/80 backdrop-blur-md border border-gray-100 rounded-3xl shadow-lg shadow-violet-500/5 p-6 lg:p-8 space-y-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-hex-primary mb-1">Настройки</p>
                <h3 className="text-2xl font-bold text-hex-dark">Уведомления и приватность</h3>
              </div>
              <Button variant="secondary">Сохранить</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: 'E-mail уведомления',
                  description: 'Результаты примерок, статусы оплаты',
                  checked: true
                },
                {
                  title: 'Push внутри сервиса',
                  description: 'Оповещения о новых размерах и скидках',
                  checked: true
                },
                {
                  title: 'Публичность профиля',
                  description: 'Показывать подборки при шаринге',
                  checked: false
                },
                {
                  title: 'Сбор аналитики',
                  description: 'Помогать улучшать рекомендации',
                  checked: true
                }
              ].map((item) => (
                <label
                  key={item.title}
                  className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100 hover:border-hex-primary/30 transition"
                >
                  <input
                    type="checkbox"
                    defaultChecked={item.checked}
                    className="mt-1 h-4 w-4 accent-hex-primary rounded"
                  />
                  <div>
                    <p className="text-sm font-semibold text-hex-dark">{item.title}</p>
                    <p className="text-sm text-hex-gray">{item.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </AccountShell>
      </section>
    </Layout>
  );
}