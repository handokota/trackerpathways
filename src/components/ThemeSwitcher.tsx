"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) return <div className="w-9 h-9" />;

  const currentIcon = resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode';

  const themes = [
    { id: 'light', icon: 'light_mode', label: 'Light' },
    { id: 'dark', icon: 'dark_mode', label: 'Dark' },
    { id: 'system', icon: 'desktop_windows', label: 'System' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 flex items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all"
        aria-label="Change Theme"
      >
        <span className="material-symbols-rounded text-lg">
           {currentIcon}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-card rounded-xl border border-foreground/10 p-1 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-foreground/5 font-medium rounded-md ${
                theme === t.id 
                  ? "text-foreground" 
                  : "text-foreground/60" 
              }`}
            >
              <span className="material-symbols-rounded text-lg">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}