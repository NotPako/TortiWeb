'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

type UserContextValue = {
  userName: string | null;
  isReady: boolean;
  signIn: (name: string) => void;
  signOut: () => void;
};

const STORAGE_KEY = 'tortiweb.userName';

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userName, setUserName] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setUserName(stored);
    } catch {
      // ignore
    }
    setIsReady(true);
  }, []);

  const signIn = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // ignore
    }
  }, []);

  const signOut = useCallback(() => {
    setUserName(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <UserContext.Provider value={{ userName, isReady, signIn, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser debe usarse dentro de <UserProvider>.');
  return ctx;
}
