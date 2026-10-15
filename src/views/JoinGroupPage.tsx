'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { Alert, Button, Result, Skeleton } from 'antd';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import {
  INVITE_PREVIEW_QUERY,
  REDEEM_INVITE_MUTATION,
} from '@/graphql/operations';
import { groupPath } from '@/lib/groups';
import { normalizeInviteCode, type InviteStatus } from '@/lib/invites';
import type { TranslationKey } from '@/lib/i18n';
import { withCallbackUrl } from '@/lib/navigation';
import type { GroupSummary, InvitePreviewData } from '@/types/groups';

type Props = { code: string };

const INACTIVE_TITLE = {
  revoked: 'join.status.revoked',
  expired: 'join.status.expired',
  exhausted: 'join.status.exhausted',
} as const satisfies Record<Exclude<InviteStatus, 'active'>, TranslationKey>;

/**
 * Destino del enlace de invitación. Sin sesión manda a login conservando el
 * enlace en `callbackUrl`, para que un invitado nuevo pueda registrarse y
 * volver aquí sin perderlo.
 */
export default function JoinGroupPage({ code }: Props) {
  const { userName, isReady } = useUser();
  const { t } = useLanguage();
  const router = useRouter();
  const client = useApolloClient();
  const normalized = normalizeInviteCode(code);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !userName) {
      router.replace(withCallbackUrl('/login', `/join/${normalized}`));
    }
  }, [isReady, userName, router, normalized]);

  const { data, loading } = useQuery<InvitePreviewData>(INVITE_PREVIEW_QUERY, {
    variables: { code: normalized },
    skip: !userName || !normalized,
    fetchPolicy: 'network-only',
  });
  const preview = data?.invitePreview ?? null;

  const [redeem, { loading: joining }] = useMutation<{
    redeemInvite: GroupSummary;
  }>(REDEEM_INVITE_MUTATION);

  // Si ya es miembro no hay nada que aceptar: directo al grupo.
  useEffect(() => {
    if (preview?.alreadyMember) {
      router.replace(groupPath(preview.groupSlug, 'vote'));
    }
  }, [preview, router]);

  async function handleJoin() {
    setError(null);
    try {
      const result = await redeem({ variables: { code: normalized } });
      const slug = result.data?.redeemInvite.slug;
      // Si antes se intentó abrir el grupo sin ser miembro, la caché guarda
      // `group(slug)` como null. Lo descartamos para que se vuelva a pedir.
      client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'group' });
      client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'myGroups' });
      client.cache.gc();
      if (slug) router.replace(groupPath(slug, 'vote'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errorPrefix'));
    }
  }

  if (!isReady || !userName || (loading && !data) || preview?.alreadyMember) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  const backButton = (
    <Link href="/groups">
      <Button>{t('groups.backToList')}</Button>
    </Link>
  );

  if (!preview) {
    return (
      <Result
        status="404"
        title={t('join.invalid.title')}
        subTitle={t('join.invalid.subtitle')}
        extra={backButton}
      />
    );
  }

  if (preview.status !== 'active') {
    return (
      <Result
        status="warning"
        title={t(INACTIVE_TITLE[preview.status])}
        subTitle={t('join.askAgain', { name: preview.groupName })}
        extra={backButton}
      />
    );
  }

  return (
    <Result
      icon={<span style={{ fontSize: 56 }}>🍳</span>}
      title={t('join.title', { name: preview.groupName })}
      subTitle={t('join.subtitle')}
      extra={
        <>
          {error ? (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 16, textAlign: 'left' }}
            />
          ) : null}
          <Button type="primary" size="large" loading={joining} onClick={handleJoin}>
            {t('join.submit')}
          </Button>
        </>
      }
    />
  );
}
