import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Filter } from 'lucide-react';

export type TryOnStatus = 'success' | 'pending' | 'failed';

export interface TryOnItem {
  id: string;
  date: string;
  product: string;
  type: '2D' | '3D';
  status: TryOnStatus;
  conversion: number;
  sizeHint?: string;
}

interface TryOnHistoryProps {
  items: TryOnItem[];
}

export function TryOnHistory({ items }: TryOnHistoryProps) {
  const [filter, setFilter] = useState<TryOnStatus | 'all'>('all');

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => item.status === filter);
  }, [filter, items]);

  const getStatusBadge = (status: TryOnStatus) => {
    const map = {
      success: { label: 'Успешно', variant: 'success' as const },
      pending: { label: 'В обработке', variant: 'warning' as const },
      failed: { label: 'Ошибка', variant: 'neutral' as const }
    };

    const { label, variant } = map[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <section
      id="activity"
      className="bg-white/80 backdrop-blur-md border border-gray-100 rounded-3xl shadow-lg shadow-violet-500/5 p-6 lg:p-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-hex-primary mb-1">История примерок</p>
          <h3 className="text-2xl font-bold text-hex-dark">Последние сессии</h3>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'success', 'pending', 'failed'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                filter === key
                  ? 'bg-hex-primary text-white border-hex-primary shadow-violet-500/30 shadow-lg'
                  : 'bg-white border-gray-200 text-hex-gray hover:border-hex-primary/40 hover:text-hex-dark'
              }`}
            >
              {key === 'all' ? 'Все' : key === 'success' ? 'Успешные' : key === 'pending' ? 'В обработке' : 'Ошибки'}
            </button>
          ))}
          <Button variant="secondary" size="sm" icon={<Filter size={16} />}>Фильтры</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="text-left text-sm text-hex-gray">
              <th className="py-3 pr-4 font-semibold">Дата</th>
              <th className="py-3 pr-4 font-semibold">Товар</th>
              <th className="py-3 pr-4 font-semibold">Тип</th>
              <th className="py-3 pr-4 font-semibold">Размер</th>
              <th className="py-3 pr-4 font-semibold">Статус</th>
              <th className="py-3 pr-4 font-semibold">Конверсия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredItems.map((item) => (
              <tr key={item.id} className="text-sm text-hex-dark hover:bg-hex-bg/40 transition-colors">
                <td className="py-4 pr-4 font-semibold">{item.date}</td>
                <td className="py-4 pr-4">
                  <p className="font-semibold">{item.product}</p>
                  <p className="text-xs text-hex-gray">ID: {item.id}</p>
                </td>
                <td className="py-4 pr-4">
                  <Badge variant="primary">{item.type}</Badge>
                </td>
                <td className="py-4 pr-4 text-hex-gray">{item.sizeHint ?? '—'}</td>
                <td className="py-4 pr-4">{getStatusBadge(item.status)}</td>
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-hex-bg overflow-hidden max-w-[120px]">
                      <div
                        className={`h-full rounded-full ${item.conversion > 65 ? 'bg-hex-primary' : 'bg-orange-400'}`}
                        style={{ width: `${item.conversion}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-hex-dark">{item.conversion}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
