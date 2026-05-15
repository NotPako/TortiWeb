'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { signIn, useSession } from 'next-auth/react';
import { Alert, Button, Form, Input } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import { REGISTER_MUTATION } from '@/graphql/operations';
import styles from './LoginPage.module.css';

type RegisterValues = {
  username: string;
  email: string;
  password: string;
};

export default function RegisterPage() {
  const { t } = useLanguage();
  const { status, data } = useSession();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [register, { loading }] = useMutation(REGISTER_MUTATION);

  useEffect(() => {
    if (status === 'authenticated') {
      if (data?.user?.needsUsername) {
        router.replace('/auth/setup-username');
      } else {
        router.replace('/vote');
      }
    }
  }, [status, data, router]);

  async function handleSubmit(values: RegisterValues) {
    setError(null);
    try {
      await register({
        variables: {
          input: {
            username: values.username.trim(),
            email: values.email.trim(),
            password: values.password,
          },
        },
      });
      const res = await signIn('credentials', {
        username: values.username.trim(),
        password: values.password,
        redirect: false,
      });
      if (res?.error) {
        setError(t('auth.errors.invalidCredentials'));
      } else {
        router.replace('/vote');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errorPrefix'));
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            🍳
          </span>
          <h1 className={styles.title}>{t('auth.register.title')}</h1>
        </div>
        <p className={styles.subtitle}>{t('auth.register.subtitle')}</p>

        <Form<RegisterValues>
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
            label={t('auth.emailLabel')}
            name="email"
            rules={[
              { required: true, message: t('auth.emailLabel') },
              { type: 'email', message: t('auth.emailLabel') },
            ]}
          >
            <Input type="email" autoComplete="email" />
          </Form.Item>
          <Form.Item
            label={t('auth.passwordLabel')}
            name="password"
            rules={[
              { required: true, message: t('auth.passwordLabel') },
              { min: 8, message: t('auth.passwordLabel') },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          {error ? (
            <Form.Item>
              <Alert type="error" message={error} showIcon />
            </Form.Item>
          ) : null}
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {t('auth.register.submit')}
            </Button>
          </Form.Item>
        </Form>

        <p className={styles.footer}>
          {t('auth.register.haveAccount')}{' '}
          <Link href="/login" className={styles.link}>
            {t('auth.register.loginLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
