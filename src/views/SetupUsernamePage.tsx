'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { useSession } from 'next-auth/react';
import { Alert, Button, Form, Input } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import { SET_USERNAME_MUTATION } from '@/graphql/operations';
import { safeCallbackUrl } from '@/lib/navigation';
import styles from './LoginPage.module.css';

type SetupValues = {
  username: string;
};

export default function SetupUsernamePage() {
  const { t } = useLanguage();
  const { status, data, update } = useSession();
  const router = useRouter();
  const callbackUrl = safeCallbackUrl(useSearchParams().get('callbackUrl'));

  const [error, setError] = useState<string | null>(null);
  const [setUsernameMutation, { loading }] = useMutation(
    SET_USERNAME_MUTATION
  );

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated' && !data?.user?.needsUsername) {
      router.replace(callbackUrl);
    }
  }, [status, data, router, callbackUrl]);

  async function handleSubmit(values: SetupValues) {
    setError(null);
    try {
      await setUsernameMutation({
        variables: { username: values.username.trim() },
      });
      await update();
      router.replace(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errorPrefix'));
    }
  }

  if (status !== 'authenticated' || !data?.user?.needsUsername) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            🍳
          </span>
          <h1 className={styles.title}>{t('auth.setupUsername.title')}</h1>
        </div>
        <p className={styles.subtitle}>{t('auth.setupUsername.subtitle')}</p>

        <Form<SetupValues>
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          <Form.Item
            label={t('auth.usernameLabel')}
            name="username"
            rules={[{ required: true, message: t('auth.usernameLabel') }]}
          >
            <Input autoComplete="username" autoFocus />
          </Form.Item>
          {error ? (
            <Form.Item>
              <Alert type="error" message={error} showIcon />
            </Form.Item>
          ) : null}
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {t('auth.setupUsername.submit')}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
