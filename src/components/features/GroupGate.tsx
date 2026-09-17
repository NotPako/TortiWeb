'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Result, Skeleton, Tag } from 'antd';
import { SwapOutlined, TeamOutlined } from '@ant-design/icons';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';
import { withCallbackUrl } from '@/lib/navigation';
import styles from './GroupGate.module.css';

/**
 * Puerta de todas las rutas `/g/[slug]/…`: exige sesión y ser miembro antes de
 * renderizar nada del grupo, y pinta la cabecera con el nombre del grupo.
 *
 * Es solo UX: la autorización real está en los resolvers. Para quien no es
 * miembro muestra lo mismo que si el grupo no existiera.
 */
export function GroupGate({ children }: { children: ReactNode }) {
  const { userName, isReady } = useUser();
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const { group, loading, error, pathFor } = useCurrentGroup();

  useEffect(() => {
    if (isReady && !userName) {
      router.replace(withCallbackUrl('/login', pathname));
    }
  }, [isReady, userName, router, pathname]);

  if (!isReady || !userName || loading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (error) {
    return (
      <Result
        status="error"
        title={t('group.loadError')}
        subTitle={error.message}
      />
    );
  }

  if (!group) {
    return (
      <Result
        status="404"
        title={t('group.notFound.title')}
        subTitle={t('group.notFound.subtitle')}
        extra={
          <Link href="/groups">
            <Button type="primary">{t('groups.backToList')}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.eyebrow}>{t('group.eyebrow')}</span>
          <span className={styles.name}>{group.name}</span>
          {group.isAdmin ? <Tag color="orange">{t('members.role.admin')}</Tag> : null}
        </div>
        <div className={styles.actions}>
          <Link href={pathFor('members')}>
            <Button size="small" icon={<TeamOutlined />}>
              {group.memberCount === 1
                ? t('group.memberSingular')
                : t('group.members', { n: group.memberCount })}
            </Button>
          </Link>
          <Link href="/groups">
            <Button size="small" type="text" icon={<SwapOutlined />}>
              {t('group.switch')}
            </Button>
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
