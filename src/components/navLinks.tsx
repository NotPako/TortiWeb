'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import {
  HistoryOutlined,
  SettingOutlined,
  StarOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { TranslationKey } from '@/lib/i18n';
import { UPCOMING_TORTILLA_QUERY } from '@/graphql/operations';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';

export type NavLink = {
  href: string;
  labelKey: TranslationKey;
  icon: ReactNode;
  /** Contador rojo junto al enlace (solicitudes pendientes en Admin). */
  badge?: number;
};

/**
 * Secciones de la navegación, compartidas por la barra superior y la de
 * pestañas. Dentro de `/g/<slug>` son las del grupo; fuera (o si el grupo no
 * existe o no eres miembro), la lista de grupos y la cuenta.
 */
export function useNavLinks(): {
  links: NavLink[];
  inGroup: boolean;
  /** Solicitudes de plaza pendientes del grupo, si eres su admin. */
  pendingRequests: number;
  profileHref: string;
} {
  const { slug, group, loading, isAdmin, pathFor } = useCurrentGroup();
  const inGroup = Boolean(slug) && (loading || group !== null);
  const pendingRequests = usePendingRequestCount(inGroup && isAdmin ? slug : null);

  const links: NavLink[] = inGroup
    ? [
        { href: pathFor('vote'), labelKey: 'nav.vote', icon: <StarOutlined /> },
        { href: pathFor('history'), labelKey: 'nav.history', icon: <HistoryOutlined /> },
        { href: pathFor('ranking'), labelKey: 'nav.ranking', icon: <TrophyOutlined /> },
        { href: pathFor('profile'), labelKey: 'nav.profile', icon: <UserOutlined /> },
        ...(isAdmin
          ? [
              {
                href: pathFor('admin'),
                labelKey: 'nav.admin' as const,
                icon: <SettingOutlined />,
                badge: pendingRequests,
              },
            ]
          : []),
      ]
    : [
        { href: '/groups', labelKey: 'nav.groups', icon: <TeamOutlined /> },
        { href: '/profile', labelKey: 'nav.account', icon: <UserOutlined /> },
      ];

  return {
    links,
    inGroup,
    pendingRequests,
    profileHref: inGroup ? pathFor('profile') : '/profile',
  };
}

/**
 * Solicitudes de plaza pendientes del grupo, para el contador de la pestaña
 * Admin. Se consulta cada minuto: así el admin se entera sin entrar al panel.
 * `slug: null` = no consultar (fuera de un grupo o sin ser admin).
 */
function usePendingRequestCount(slug: string | null): number {
  const { data } = useQuery<{
    upcomingTortilla: { open: boolean; pendingRequestCount: number } | null;
  }>(UPCOMING_TORTILLA_QUERY, {
    variables: { groupSlug: slug ?? '' },
    skip: !slug,
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
