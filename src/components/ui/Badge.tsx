import { clsx } from 'clsx';
import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'neutral' | 'warning';
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'neutral',
  className 
}: BadgeProps) {
  const variants = {
    primary: "bg-hex-primary/10 text-hex-primary",
    success: "bg-green-100 text-green-700",
    neutral: "bg-gray-100 text-gray-600",
    warning: "bg-orange-100 text-orange-700",
  };

  return (
    <span className={clsx(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
