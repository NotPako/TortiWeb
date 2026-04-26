'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  LOCALE_TAG,
  Language,
  SUPPORTED_LANGUAGES,
  TranslationKey,
  translate,
} from '@/lib/i18n';

const STORAGE_KEY = 'tortiweb.language';

type LanguageContextValue = {
  lang: Language;
  locale: string;
  isReady: boolean;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectInitialLang(): Language {
  try {
    const nav = (window.navigator.language || '').toLowerCase();
    if (nav.startsWith('ca')) return 'ca';
  } catch {
    // ignore
  }
  return 'es';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('es');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        STORAGE_KEY
      ) as Language | null;
      if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
        setLangState(stored);
      } else {
        setLangState(detectInitialLang());
      }
    } catch {
      // ignore
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      locale: LOCALE_TAG[lang],
      isReady,
      setLang,
      t: (key, params) => translate(lang, key, params),
    }),
    [lang, isReady, setLang]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error('useLanguage debe usarse dentro de <LanguageProvider>.');
  return ctx;
}
