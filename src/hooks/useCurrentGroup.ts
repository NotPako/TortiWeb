'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { useUser } from '@/components/UserContext';
import { GROUP_QUERY } from '@/graphql/operations';
import { groupPath, type GroupSection } from '@/lib/groups';
import type { GroupSummary } from '@/types/groups';

/**
 * Grupo de la ruta actual (`/g/[slug]/…`), o `null` fuera de un grupo.
 *
 * El slug sale de la URL con `useParams`, así que funciona igual en las vistas
 * del grupo que en la navbar del layout raíz, sin pasar props en cascada. Todas
 * las llamadas comparten la misma query en la caché de Apollo: solo la primera
 * va a red.
 */
export function useCurrentGroup() {
  const params = useParams<{ slug?: string | string[] }>();
  const slug = typeof params?.slug === 'string' ? params.slug : null;
  const { userName } = useUser();

  const { data, loading, error } = useQuery<{ group: GroupSummary | null }>(
    GROUP_QUERY,
    {
      variables: { slug: slug ?? '' },
      skip: !slug || !userName,
      fetchPolicy: 'cache-first',
    }
  );

  const group = data?.group ?? null;

  /** Ruta de una sección del grupo actual; `/groups` si no hay grupo. */
  const pathFor = useCallback(
    (section?: GroupSection) => (slug ? groupPath(slug, section) : '/groups'),
    [slug]
  );

  return {
    slug,
    group,
    isAdmin: Boolean(group?.isAdmin),
    loading: Boolean(slug && userName) && loading && !data,
    error,
    pathFor,
  };
}
