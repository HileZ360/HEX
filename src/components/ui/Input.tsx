import { InputHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

export function Input({ 
  label, 
  error, 
  icon, 
  rightElement,
  className, 
  ...props 
}: InputProps) {
  return (
    <div className="w-full group">
      {label && (
        <label className="block text-sm font-semibold text-hex-gray mb-2 ml-1">
          {label}
        </label>
      )}
      <div className="relative transition-all duration-300">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-hex-primary transition-colors">
            {icon}
          </div>
        )}
        <input
          className={clsx(
            "block w-full rounded-2xl border-2 border-transparent bg-white text-hex-dark placeholder-gray-400",
            "focus:border-hex-primary/20 focus:bg-white focus:ring-4 focus:ring-hex-primary/10 focus:outline-none",
            "shadow-sm hover:shadow-md transition-all duration-300",
            icon ? "pl-12" : "pl-5",
            rightElement ? "pr-14" : "pr-5",
            "py-4 text-base",
            error && "border-red-300 focus:border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-500 ml-1 font-medium">{error}</p>
      )}
    </div>
  );
}
