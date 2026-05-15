'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Alert, Button, Divider, Form, Input } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import styles from './LoginPage.module.css';

type LoginValues = {
  username: string;
  password: string;
};

export default function LoginPage() {
  const { t } = useLanguage();
  const { status, data } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/vote';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      if (data?.user?.needsUsername) {
        router.replace('/auth/setup-username');
      } else {
        router.replace(callbackUrl);
      }
    }
  }, [status, data, router, callbackUrl]);

  async function handleSubmit(values: LoginValues) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await signIn('credentials', {
        username: values.username.trim(),
        password: values.password,
        redirect: false,
      });
      if (res?.error) {
        setError(t('auth.errors.invalidCredentials'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogle() {
    signIn('google', { callbackUrl: '/auth/setup-username' });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            🍳
          </span>
          <h1 className={styles.title}>{t('app.title')}</h1>
        </div>
        <p className={styles.subtitle}>{t('auth.login.subtitle')}</p>

        <Form<LoginValues>
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
          <Form.Item
            label={t('auth.passwordLabel')}
            name="password"
            rules={[{ required: true, message: t('auth.passwordLabel') }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {error ? (
            <Form.Item>
              <Alert type="error" message={error} showIcon />
            </Form.Item>
          ) : null}
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              {t('auth.login.submit')}
            </Button>
          </Form.Item>
        </Form>

        <Divider plain>{t('auth.or')}</Divider>

        <Button block onClick={handleGoogle}>
          {t('auth.google.signIn')}
        </Button>

        <p className={styles.footer}>
          {t('auth.login.noAccount')}{' '}
          <Link href="/register" className={styles.link}>
            {t('auth.login.registerLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
