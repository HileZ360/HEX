import { clsx } from 'clsx';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'light';
}

export function Logo({ className, variant = 'default' }: LogoProps) {
  return (
    <div className={clsx("flex items-center gap-2 font-bold text-2xl tracking-tight", className)}>
      <div className="relative w-8 h-8 flex items-center justify-center">
        <div className="absolute inset-0 bg-hex-primary rounded-full opacity-20"></div>
        <span className="relative text-hex-primary">X</span>
      </div>
      <span className={variant === 'light' ? 'text-white' : 'text-hex-dark'}>HEX</span>
    </div>
  );
}
