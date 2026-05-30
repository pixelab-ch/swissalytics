'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'fr' | 'en';
export type Density = 'compact' | 'normal' | 'roomy';

interface ThemeContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
  density: Density;
  setDensity: (d: Density) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const LS_LANG = 'sa_lang';
const LS_DARK = 'sa_dark';
const LS_DENSITY = 'sa_density';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');
  const [dark, setDarkState] = useState(false);
  const [density, setDensityState] = useState<Density>('normal');
  const [mounted, setMounted] = useState(false);
  // Night mode is disabled on phones (<768px). We keep the user's dark
  // preference (it applies on desktop) but never render dark on mobile, so a
  // stored pref can't trap a phone in dark mode where the toggle is hidden.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try {
      const l = localStorage.getItem(LS_LANG);
      const d = localStorage.getItem(LS_DARK);
      const den = localStorage.getItem(LS_DENSITY);
      if (l === 'fr' || l === 'en') setLangState(l);
      if (d === 'true' || d === 'false') setDarkState(d === 'true');
      if (den === 'compact' || den === 'normal' || den === 'roomy') setDensityState(den);
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const effectiveDark = dark && !isMobile;
    html.setAttribute('lang', lang);
    html.setAttribute('data-dark', effectiveDark ? 'true' : 'false');
    html.setAttribute('data-density', density);
    try {
      localStorage.setItem(LS_LANG, lang);
      localStorage.setItem(LS_DARK, dark ? 'true' : 'false');
      localStorage.setItem(LS_DENSITY, density);
    } catch {}
  }, [lang, dark, density, mounted, isMobile]);

  const setLang = (l: Lang) => setLangState(l);
  const setDark = (d: boolean) => setDarkState(d);
  const setDensity = (d: Density) => setDensityState(d);

  return (
    <ThemeContext.Provider value={{ lang, setLang, dark, setDark, density, setDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useLang(): Lang {
  return useTheme().lang;
}
