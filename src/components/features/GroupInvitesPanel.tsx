'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@apollo/client';
import {
  Button,
  Card,
  Empty,
  List,
  Popconfirm,
  Select,
  Typography,
  message,
} from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useLanguage } from '@/components/LanguageContext';
import {
  CREATE_INVITE_MUTATION,
  REVOKE_INVITE_MUTATION,
} from '@/graphql/operations';
import { formatInviteCode } from '@/lib/invites';
import type { GroupInviteItem } from '@/types/groups';
import styles from './GroupInvitesPanel.module.css';

type Props = {
  slug: string;
  invites: GroupInviteItem[];
  onChanged: () => void | Promise<unknown>;
};

/** `0` = sin límite. Opciones cerradas para no validar texto libre. */
const EXPIRY_DAYS = [0, 1, 7, 30] as const;
const MAX_USES = [0, 1, 5, 10, 25] as const;

export function GroupInvitesPanel({ slug, invites, onChanged }: Props) {
  const { t, locale } = useLanguage();
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [maxUses, setMaxUses] = useState<number>(0);
  // El origen solo existe en el navegador; en el render de servidor, vacío.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const [createInvite, { loading: creating }] = useMutation(
    CREATE_INVITE_MUTATION
  );
  const [revokeInvite] = useMutation(REVOKE_INVITE_MUTATION);

  const active = useMemo(
    () => invites.filter((invite) => invite.status === 'active'),
    [invites]
  );

  async function handleCreate() {
    try {
      await createInvite({
        variables: {
          input: {
            groupSlug: slug,
            expiresInDays: expiresInDays || null,
            maxUses: maxUses || null,
          },
        },
      });
      await onChanged();
      message.success(t('invites.created'));
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('common.errorPrefix'));
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeInvite({ variables: { id } });
      await onChanged();
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('common.errorPrefix'));
    }
  }

  function describe(invite: GroupInviteItem): string {
    const uses =
      invite.maxUses != null
        ? t('invites.usesOf', { uses: invite.uses, max: invite.maxUses })
        : t('invites.uses', { uses: invite.uses });
    const expiry = invite.expiresAt
      ? t('invites.expiresOn', {
          date: new Date(invite.expiresAt).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
          }),
        })
      : t('invites.noExpiry');
    return `${uses} · ${expiry}`;
  }

  return (
    <Card title={t('invites.title')} className={styles.card}>
      <p className={styles.hint}>{t('invites.subtitle')}</p>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>{t('invites.expiryLabel')}</span>
          <Select
            value={expiresInDays}
            onChange={setExpiresInDays}
            options={EXPIRY_DAYS.map((days) => ({
              value: days,
              label: days === 0 ? t('invites.never') : t('invites.days', { n: days }),
            }))}
          />
        </label>
        <label className={styles.field}>
          <span>{t('invites.maxUsesLabel')}</span>
          <Select
            value={maxUses}
            onChange={setMaxUses}
            options={MAX_USES.map((n) => ({
              value: n,
              label: n === 0 ? t('invites.unlimited') : String(n),
            }))}
          />
        </label>
        <Button
          type="primary"
          icon={<LinkOutlined />}
          loading={creating}
          onClick={handleCreate}
        >
          {t('invites.create')}
        </Button>
      </div>

      {active.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('invites.empty')}
        />
      ) : (
        <List
          dataSource={active}
          rowKey="id"
          renderItem={(invite) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="revoke"
                  title={t('invites.revokeConfirm')}
                  okText={t('invites.revoke')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleRevoke(invite.id)}
                >
                  <Button size="small" type="link" danger>
                    {t('invites.revoke')}
                  </Button>
                </Popconfirm>,
              ]}
            >
              <div className={styles.invite}>
                <Typography.Text
                  strong
                  copyable={{ text: invite.code }}
                  className={styles.code}
                >
                  {formatInviteCode(invite.code)}
                </Typography.Text>
                {origin ? (
                  <Typography.Text
                    type="secondary"
                    copyable={{ text: `${origin}/join/${invite.code}` }}
                    ellipsis
                    className={styles.link}
                  >
                    {`${origin}/join/${invite.code}`}
                  </Typography.Text>
                ) : null}
                <span className={styles.meta}>{describe(invite)}</span>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
