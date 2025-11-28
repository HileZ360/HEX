import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './ui/Logo';
import { User, HelpCircle, FileText } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-hex-bg flex flex-col">
      <header className="sticky top-0 z-40 w-full bg-hex-bg/80 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <Logo />
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/#how-it-works" className="text-sm font-medium text-hex-gray hover:text-hex-primary transition-colors">
              Как это работает
            </Link>
            <Link to="/faq#faq" className="text-sm font-medium text-hex-gray hover:text-hex-primary transition-colors">
              FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <button className="p-2 text-hex-gray hover:text-hex-primary hover:bg-hex-primary/5 rounded-full transition-colors md:hidden">
              <HelpCircle size={20} />
            </button>
            <button className="p-2 text-hex-gray hover:text-hex-primary hover:bg-hex-primary/5 rounded-full transition-colors">
              <User size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-100 py-8 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
            © 2025 HEX Virtual Try-On. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-gray-400 hover:text-hex-primary transition-colors">Privacy</a>
            <a href="#" className="text-sm text-gray-400 hover:text-hex-primary transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
