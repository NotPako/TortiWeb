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
import { ConfigProvider, theme as antdTheme } from 'antd';

export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'tortiweb.theme';

/**
 * Se ejecuta en el <head> antes de pintar: fija `data-theme` con la
 * preferencia guardada o, si no hay, la del sistema. Así las variables CSS
 * ya están bien en el primer frame y no hay parpadeo.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

type ThemeContextValue = {
  theme: ResolvedTheme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
}

function readStored(): ResolvedTheme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Tema claro/oscuro. Sin elección guardada sigue al sistema (y cambia con
 * él); al pulsar el botón la elección se guarda y deja de seguirlo.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // En el servidor no sabemos el tema: empezamos en claro y, al montar,
  // leemos el que ya fijó el script del <head>. Las variables CSS ya son
  // correctas desde el principio; solo los componentes de antd se ajustan.
  const [theme, setTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === 'dark' || current === 'light') setTheme(current);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (readStored()) return;
      const next = e.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Sin almacenamiento el cambio dura lo que la pestaña.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  const antd = useMemo(
    () => ({
      algorithm:
        theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: theme === 'dark' ? '#f59300' : '#db7c00',
        colorLink: theme === 'dark' ? '#ffb43c' : '#a85c00',
        colorBgContainer: theme === 'dark' ? '#211a0f' : '#ffffff',
        colorBgElevated: theme === 'dark' ? '#2a2114' : '#ffffff',
        colorBorder: theme === 'dark' ? '#4a3c27' : '#e8dcc6',
        colorBorderSecondary: theme === 'dark' ? '#3a2f1f' : '#efe5d4',
        borderRadius: 9,
        fontFamily: 'var(--font-ui)',
      },
      components: {
        // Blanco sobre ámbar no llega a 3:1: el botón principal lleva tinta.
        Button: { primaryColor: '#1c1407', primaryShadow: 'none' },
        // El gris por defecto de la cabecera desentona con la paleta cálida.
        Collapse: { headerBg: 'transparent' },
      },
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antd}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
