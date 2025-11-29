import { ReactNode } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: string;
  helper?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: ReactNode;
}

export function StatCard({ label, value, helper, trend, icon }: StatCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur-md border border-gray-100 rounded-3xl shadow-lg shadow-violet-500/5 p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="text-sm font-semibold text-hex-gray">{label}</div>
        {icon && (
          <div className="h-10 w-10 rounded-2xl bg-hex-bg text-hex-primary flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-3 mb-2">
        <p className="text-3xl font-bold text-hex-dark">{value}</p>
        {trend && (
          <span
            className={clsx(
              'text-sm font-semibold px-2 py-1 rounded-full',
              trend.isPositive
                ? 'bg-green-50 text-green-700'
                : 'bg-orange-50 text-orange-700'
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {helper && <p className="text-sm text-hex-gray">{helper}</p>}
    </div>
  );
}
