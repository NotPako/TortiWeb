'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Button, List, Popconfirm, Tag, message } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import {
  REMOVE_MEMBER_MUTATION,
  SET_MEMBER_ROLE_MUTATION,
} from '@/graphql/operations';
import type { GroupRole } from '@/lib/groups';
import type { GroupMemberItem } from '@/types/groups';
import { UserChip } from './UserChip';
import styles from './GroupMembersList.module.css';

type Props = {
  slug: string;
  members: GroupMemberItem[];
  /** El usuario autenticado es admin: puede cambiar roles y expulsar. */
  canManage: boolean;
  onChanged: () => void | Promise<unknown>;
};

export function GroupMembersList({ slug, members, canManage, onChanged }: Props) {
  const { t, locale } = useLanguage();
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [setRole] = useMutation(SET_MEMBER_ROLE_MUTATION);
  const [removeMember] = useMutation(REMOVE_MEMBER_MUTATION);

  async function run(userName: string, action: () => Promise<unknown>) {
    setBusyUser(userName);
    try {
      await action();
      await onChanged();
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('common.errorPrefix'));
    } finally {
      setBusyUser(null);
    }
  }

  function toggleRole(member: GroupMemberItem) {
    const role: GroupRole = member.role === 'admin' ? 'member' : 'admin';
    return run(member.userName, () =>
      setRole({ variables: { groupSlug: slug, userName: member.userName, role } })
    );
  }

  function remove(member: GroupMemberItem) {
    return run(member.userName, () =>
      removeMember({ variables: { groupSlug: slug, userName: member.userName } })
    );
  }

  function formatDate(date: string) {
    try {
      return new Date(date).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }

  return (
    <List
      className={styles.list}
      dataSource={members}
      rowKey="userName"
      renderItem={(member) => {
        const busy = busyUser === member.userName;
        const actions = canManage
          ? [
              <Button
                key="role"
                size="small"
                type="link"
                loading={busy}
                onClick={() => toggleRole(member)}
              >
                {member.role === 'admin'
                  ? t('members.demote')
                  : t('members.promote')}
              </Button>,
              ...(member.isMe
                ? []
                : [
                    <Popconfirm
                      key="remove"
                      title={t('members.removeConfirm', { name: member.userName })}
                      okText={t('members.remove')}
                      cancelText={t('common.cancel')}
                      okButtonProps={{ danger: true }}
                      onConfirm={() => remove(member)}
                    >
                      <Button size="small" type="link" danger disabled={busy}>
                        {t('members.remove')}
                      </Button>
                    </Popconfirm>,
                  ]),
            ]
          : [];
        return (
          <List.Item actions={actions}>
            <div className={styles.member}>
              <UserChip userName={member.userName} imageUrl={member.imageUrl} />
              <div className={styles.meta}>
                {member.role === 'admin' ? (
                  <Tag color="orange">{t('members.role.admin')}</Tag>
                ) : null}
                {member.isMe ? <Tag>{t('members.you')}</Tag> : null}
                <span className={styles.joined}>
                  {t('members.joinedAt', { date: formatDate(member.joinedAt) })}
                </span>
              </div>
            </div>
          </List.Item>
        );
      }}
    />
  );
}
