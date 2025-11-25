import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  icon?: ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  className, 
  children, 
  icon,
  ...props 
}: ButtonProps) {
  const baseStyles = "relative overflow-hidden inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";
  
  const variants = {
    primary: "bg-hex-primary text-white hover:bg-violet-700 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 focus:ring-hex-primary border border-transparent group",
    secondary: "bg-white text-hex-dark hover:bg-gray-50 border border-gray-100 shadow-sm hover:shadow-md focus:ring-gray-200",
    outline: "border-2 border-hex-primary text-hex-primary hover:bg-hex-primary/5 focus:ring-hex-primary bg-transparent",
    ghost: "text-hex-gray hover:text-hex-primary hover:bg-hex-primary/5 focus:ring-hex-primary bg-transparent",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {variant === 'primary' && (
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
      )}
      <div className="relative z-20 flex items-center">
        {icon && <span className="mr-2.5">{icon}</span>}
        {children}
      </div>
    </motion.button>
  );
}
