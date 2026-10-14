'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import {
  HistoryOutlined,
  SettingOutlined,
  StarOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { TranslationKey } from '@/lib/i18n';
import { UPCOMING_TORTILLA_QUERY } from '@/graphql/operations';

export type NavLink = {
  href: string;
  labelKey: TranslationKey;
  icon: ReactNode;
};

/** Secciones de la app. Las comparten la barra superior y la de pestañas. */
export function navLinks(isAdmin: boolean): NavLink[] {
  return [
    { href: '/vote', labelKey: 'nav.vote', icon: <StarOutlined /> },
    { href: '/history', labelKey: 'nav.history', icon: <HistoryOutlined /> },
    { href: '/ranking', labelKey: 'nav.ranking', icon: <TrophyOutlined /> },
    { href: '/profile', labelKey: 'nav.profile', icon: <UserOutlined /> },
    ...(isAdmin
      ? [{ href: '/admin', labelKey: 'nav.admin' as const, icon: <SettingOutlined /> }]
      : []),
  ];
}

/**
 * Solicitudes de plaza pendientes, para el contador de la pestaña Admin. Se
 * consulta cada minuto: así el admin se entera sin tener que entrar al panel.
 */
export function usePendingRequestCount(isAdmin: boolean): number {
  const { data } = useQuery<{
    upcomingTortilla: { open: boolean; pendingRequestCount: number } | null;
  }>(UPCOMING_TORTILLA_QUERY, {
    skip: !isAdmin,
    fetchPolicy: 'cache-and-network',
    pollInterval: 60_000,
  });
  const event = data?.upcomingTortilla;
  return event?.open ? event.pendingRequestCount : 0;
}

/** `/profile/ana` también marca "Perfil"; `/` no marca nada. */
export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
