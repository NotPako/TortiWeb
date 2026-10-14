'use client';

import { ReactNode, createContext, useContext, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { BIRTHDAYS_TODAY_QUERY } from '@/graphql/operations';

/** Nombres normalizados de quienes cumplen años hoy. */
const BirthdayContext = createContext<ReadonlySet<string>>(new Set());

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Una sola consulta para toda la app: los `UserChip` solo conocen el nombre,
 * así que preguntan aquí en vez de traer el cumpleaños en cada voto o
 * comentario.
 */
export function BirthdayProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery<{ birthdaysToday: string[] }>(
    BIRTHDAYS_TODAY_QUERY,
    // Una pestaña abierta de un día para otro también cambia de gorros.
    { pollInterval: 30 * 60 * 1000 }
  );
  const names = useMemo(
    () => new Set((data?.birthdaysToday ?? []).map(nameKey)),
    [data]
  );
  return (
    <BirthdayContext.Provider value={names}>{children}</BirthdayContext.Provider>
  );
}

export function useIsBirthday(userName: string): boolean {
  return useContext(BirthdayContext).has(nameKey(userName));
}
