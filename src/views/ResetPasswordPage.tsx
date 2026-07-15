'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { Alert, Button, Form, Input } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import { RESET_PASSWORD_MUTATION } from '@/graphql/operations';
import styles from './LoginPage.module.css';

type ResetValues = {
  password: string;
  confirm: string;
};

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD_MUTATION);

  async function handleSubmit(values: ResetValues) {
    setError(null);
    try {
      await resetPassword({
        variables: { input: { token, password: values.password } },
      });
      setDone(true);
      setTimeout(() => router.replace('/login'), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.reset.errorGeneric'));
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            🍳
          </span>
          <h1 className={styles.title}>{t('auth.reset.title')}</h1>
        </div>

        {!token ? (
          <Alert
            type="error"
            message={t('auth.reset.invalidLink')}
            showIcon
          />
        ) : done ? (
          <Alert
            type="success"
            message={t('auth.reset.successTitle')}
            description={t('auth.reset.successDescription')}
            showIcon
          />
        ) : (
          <>
            <p className={styles.subtitle}>{t('auth.reset.subtitle')}</p>
            <Form<ResetValues>
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
            >
              <Form.Item
                label={t('auth.reset.newPasswordLabel')}
                name="password"
                rules={[
                  { required: true, message: t('auth.reset.newPasswordLabel') },
                  { min: 8, message: t('auth.reset.passwordTooShort') },
                ]}
              >
                <Input.Password autoComplete="new-password" autoFocus />
              </Form.Item>
              <Form.Item
                label={t('auth.reset.confirmPasswordLabel')}
                name="confirm"
                dependencies={['password']}
                rules={[
                  {
                    required: true,
                    message: t('auth.reset.confirmPasswordLabel'),
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value: string) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error(t('auth.reset.passwordMismatch'))
                      );
                    },
                  }),
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
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                >
                  {t('auth.reset.submit')}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}

        <p className={styles.footer}>
          <Link href="/login" className={styles.link}>
            {t('auth.forgot.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
