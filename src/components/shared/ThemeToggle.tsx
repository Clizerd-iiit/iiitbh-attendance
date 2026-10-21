'use client';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-xl bg-gray-100 ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl transition shadow-sm border flex items-center gap-1.5 cursor-pointer active:scale-95 ${
        theme === 'dark'
          ? 'bg-[#2b211a] border-[#4a3a2e] text-amber-300 hover:bg-[#382b22]'
          : 'bg-white/90 hover:bg-white border-gray-200 text-amber-600'
      } ${className}`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Brown Mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-300 animate-spin-slow" />
      ) : (
        <Moon className="w-4 h-4 text-amber-600" />
      )}
      <span className="text-xs font-black hidden md:inline">
        {theme === 'dark' ? 'Light' : 'Dark Brown'}
      </span>
    </button>
  );
}
