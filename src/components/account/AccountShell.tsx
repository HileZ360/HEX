import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, User, Activity, Settings, BarChart3 } from 'lucide-react';
import clsx from 'clsx';

interface AccountShellProps {
  children: ReactNode;
}

const navItems = [
  { href: '#overview', label: 'Обзор', icon: LayoutDashboard },
  { href: '#profile', label: 'Профиль', icon: User },
  { href: '#activity', label: 'История примерок', icon: Activity },
  { href: '#analytics', label: 'Аналитика', icon: BarChart3 },
  { href: '#settings', label: 'Настройки', icon: Settings }
];

export function AccountShell({ children }: AccountShellProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8">
      <aside className="bg-white/80 backdrop-blur-md border border-gray-100 rounded-3xl shadow-lg shadow-violet-500/5 p-4 lg:p-6 sticky top-24 h-fit">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-hex-primary/10 text-hex-primary flex items-center justify-center font-bold">ЛК</div>
          <div>
            <p className="text-sm text-hex-gray">Аккаунт</p>
            <p className="text-lg font-semibold text-hex-dark">HEX Virtual Try-On</p>
          </div>
        </div>
        <nav className="space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className={clsx(
                'group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold text-hex-gray transition-all',
                'hover:bg-hex-primary/5 hover:text-hex-primary'
              )}
            >
              <span className="h-9 w-9 rounded-xl bg-hex-bg flex items-center justify-center text-hex-dark group-hover:text-hex-primary group-hover:bg-hex-primary/10 transition-colors">
                <Icon size={18} />
              </span>
              {label}
            </a>
          ))}
        </nav>
        <div className="mt-6 p-4 rounded-2xl bg-hex-primary/5 border border-hex-primary/10">
          <p className="text-sm font-semibold text-hex-dark mb-1">Нужна помощь?</p>
          <p className="text-xs text-hex-gray mb-3">Саппорт отвечает в течение 5 минут.</p>
          <Link
            to="/faq#faq"
            className="inline-flex items-center gap-2 text-sm font-semibold text-hex-primary hover:text-violet-700"
          >
            Открыть FAQ →
          </Link>
        </div>
      </aside>

      <div className="space-y-8">{children}</div>
    </div>
  );
}
