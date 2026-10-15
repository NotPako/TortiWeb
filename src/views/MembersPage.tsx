'use client';

import { useRouter } from 'next/navigation';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { Button, Popconfirm, Skeleton, message } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useLanguage } from '@/components/LanguageContext';
import { useCurrentGroup } from '@/hooks/useCurrentGroup';
import { GroupMembersList } from '@/components/features/GroupMembersList';
import { GroupInvitesPanel } from '@/components/features/GroupInvitesPanel';
import {
  GROUP_MEMBERS_QUERY,
  LEAVE_GROUP_MUTATION,
} from '@/graphql/operations';
import type { GroupMembersData } from '@/types/groups';
import styles from './MembersPage.module.css';

export default function MembersPage() {
  // Sesión y pertenencia ya las garantiza GroupGate en el layout del grupo.
  const { slug } = useCurrentGroup();
  const { t } = useLanguage();
  const router = useRouter();
  const client = useApolloClient();

  const { data, loading, error, refetch } = useQuery<GroupMembersData>(
    GROUP_MEMBERS_QUERY,
    { variables: { slug }, skip: !slug }
  );
  const [leaveGroup, { loading: leaving }] = useMutation(LEAVE_GROUP_MUTATION);

  async function handleLeave() {
    try {
      await leaveGroup({ variables: { groupSlug: slug } });
      // La caché guarda el grupo como accesible: la vaciamos para no volver a
      // mostrarlo desde memoria.
      await client.clearStore();
      router.replace('/groups');
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('common.errorPrefix'));
    }
  }

  if (!slug) return null;
  if (loading && !data) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (error || !data?.group) {
    return (
      <p className={styles.error}>
        {t('common.errorPrefix')}: {error?.message}
      </p>
    );
  }

  const { group } = data;

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <h1 className={styles.title}>
          {t('members.title')}{' '}
          <span className={styles.count}>({group.memberCount})</span>
        </h1>
        <GroupMembersList
          slug={slug}
          members={group.members}
          canManage={group.isAdmin}
          onChanged={() => refetch()}
        />
      </section>

      {group.isAdmin && group.invites ? (
        <GroupInvitesPanel
          slug={slug}
          invites={group.invites}
          onChanged={() => refetch()}
        />
      ) : (
        <p className={styles.hint}>{t('members.askAdmin')}</p>
      )}

      <div className={styles.leave}>
        <Popconfirm
          title={t('members.leaveConfirm')}
          okText={t('members.leave')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true }}
          onConfirm={handleLeave}
        >
          <Button danger type="text" icon={<LogoutOutlined />} loading={leaving}>
            {t('members.leave')}
          </Button>
        </Popconfirm>
      </div>
    </div>
  );
}
