'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { Alert, Button, Card, Form, Input } from 'antd';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { CREATE_GROUP_MUTATION } from '@/graphql/operations';
import {
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MIN_GROUP_NAME_LENGTH,
  groupPath,
} from '@/lib/groups';
import { withCallbackUrl } from '@/lib/navigation';
import type { GroupSummary } from '@/types/groups';
import styles from './AccountPage.module.css';

type Values = { name: string; description?: string };

export default function CreateGroupPage() {
  const { userName, isReady } = useUser();
  const { t } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !userName) {
      router.replace(withCallbackUrl('/login', '/groups/new'));
    }
  }, [isReady, userName, router]);

  const [createGroup, { loading }] = useMutation<{ createGroup: GroupSummary }>(
    CREATE_GROUP_MUTATION,
    { refetchQueries: ['MyGroups'] }
  );

  async function handleFinish(values: Values) {
    setError(null);
    try {
      const { data } = await createGroup({
        variables: {
          input: {
            name: values.name,
            description: values.description?.trim() || null,
          },
        },
      });
      // Recién creado solo está su admin: lo primero es invitar a la gente.
      if (data) router.push(groupPath(data.createGroup.slug, 'members'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errorPrefix'));
    }
  }

  if (!isReady || !userName) return null;

  return (
    <div className={styles.wrap}>
      <Card title={t('groups.new.title')}>
        <p className={styles.hint}>{t('groups.new.subtitle')}</p>
        <Form<Values>
          layout="vertical"
          requiredMark={false}
          onFinish={handleFinish}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label={t('groups.new.nameLabel')}
            name="name"
            rules={[
              {
                required: true,
                whitespace: true,
                min: MIN_GROUP_NAME_LENGTH,
                message: t('groups.new.nameRequired'),
              },
            ]}
          >
            <Input
              maxLength={MAX_GROUP_NAME_LENGTH}
              placeholder={t('groups.new.namePlaceholder')}
              autoFocus
            />
          </Form.Item>
          <Form.Item label={t('groups.new.descriptionLabel')} name="description">
            <Input.TextArea
              maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
              showCount
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>
          {error ? (
            <Form.Item>
              <Alert type="error" message={error} showIcon />
            </Form.Item>
          ) : null}
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t('groups.new.submit')}
            </Button>{' '}
            <Link href="/groups">
              <Button type="text">{t('common.cancel')}</Button>
            </Link>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
