'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Button, Card, Empty, Input, Skeleton, Tag } from 'antd';
import { PlusOutlined, RightOutlined, TeamOutlined } from '@ant-design/icons';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { MY_GROUPS_QUERY } from '@/graphql/operations';
import { groupPath } from '@/lib/groups';
import { normalizeInviteCode } from '@/lib/invites';
import { withCallbackUrl } from '@/lib/navigation';
import type { GroupSummary } from '@/types/groups';
import styles from './GroupsPage.module.css';

/** Aterrizaje tras iniciar sesión: los grupos del usuario y cómo entrar en otro. */
export default function GroupsPage() {
  const { userName, isReady } = useUser();
  const { t } = useLanguage();
  const router = useRouter();
  const [code, setCode] = useState('');

  useEffect(() => {
    if (isReady && !userName) {
      router.replace(withCallbackUrl('/login', '/groups'));
    }
  }, [isReady, userName, router]);

  const { data, loading, error } = useQuery<{ myGroups: GroupSummary[] }>(
    MY_GROUPS_QUERY,
    { skip: !userName }
  );

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeInviteCode(code);
    if (normalized) router.push(`/join/${normalized}`);
  }

  if (!isReady || !userName) return null;

  const groups = data?.myGroups ?? [];

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{t('groups.title')}</h1>
          <p className={styles.subtitle}>{t('groups.subtitle')}</p>
        </div>
        <Link href="/groups/new">
          <Button type="primary" icon={<PlusOutlined />}>
            {t('groups.create')}
          </Button>
        </Link>
      </div>

      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : error ? (
        <p className={styles.error}>
          {t('common.errorPrefix')}: {error.message}
        </p>
      ) : groups.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <>
                <strong>{t('groups.empty.title')}</strong>
                <br />
                {t('groups.empty.subtitle')}
              </>
            }
          />
        </Card>
      ) : (
        <ul className={styles.list}>
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={groupPath(group.slug, 'vote')} className={styles.item}>
                <div className={styles.itemBody}>
                  <span className={styles.itemName}>{group.name}</span>
                  {group.description ? (
                    <span className={styles.itemDescription}>
                      {group.description}
                    </span>
                  ) : null}
                  <span className={styles.itemMeta}>
                    <TeamOutlined />{' '}
                    {group.memberCount === 1
                      ? t('group.memberSingular')
                      : t('group.members', { n: group.memberCount })}
                    {group.isAdmin ? (
                      <Tag color="orange" className={styles.roleTag}>
                        {t('members.role.admin')}
                      </Tag>
                    ) : null}
                  </span>
                </div>
                <RightOutlined className={styles.chevron} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card size="small" title={t('groups.join.title')}>
        <form onSubmit={handleJoin} className={styles.joinForm}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('groups.join.placeholder')}
            aria-label={t('groups.join.title')}
          />
          <Button htmlType="submit" disabled={!normalizeInviteCode(code)}>
            {t('groups.join.submit')}
          </Button>
        </form>
        <p className={styles.joinHint}>{t('groups.join.hint')}</p>
      </Card>
    </div>
  );
}
