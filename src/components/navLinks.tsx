'use client';

import type { ReactNode } from 'react';
import {
  HistoryOutlined,
  SettingOutlined,
  StarOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { TranslationKey } from '@/lib/i18n';

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

/** `/profile/ana` también marca "Perfil"; `/` no marca nada. */
export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
