'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Alert, Button, Form, Input } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import { REQUEST_PASSWORD_RESET_MUTATION } from '@/graphql/operations';
import styles from './LoginPage.module.css';

type ForgotValues = {
  email: string;
};

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [sent, setSent] = useState(false);
  const [requestReset, { loading }] = useMutation(
    REQUEST_PASSWORD_RESET_MUTATION
  );

  async function handleSubmit(values: ForgotValues) {
    try {
      await requestReset({ variables: { email: values.email.trim() } });
    } finally {
      // Mostramos siempre el mismo mensaje: el backend tampoco revela si el
      // email existe, y así evitamos filtrar cuentas desde el frontend.
      setSent(true);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            🍳
          </span>
          <h1 className={styles.title}>{t('auth.forgot.title')}</h1>
        </div>
        <p className={styles.subtitle}>{t('auth.forgot.subtitle')}</p>

        {sent ? (
          <Alert
            type="success"
            message={t('auth.forgot.sentTitle')}
            description={t('auth.forgot.sentDescription')}
            showIcon
          />
        ) : (
          <Form<ForgotValues>
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
          >
            <Form.Item
              label={t('auth.emailLabel')}
              name="email"
              rules={[
                { required: true, message: t('auth.emailLabel') },
                { type: 'email', message: t('auth.emailLabel') },
              ]}
            >
              <Input type="email" autoComplete="email" autoFocus />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                {t('auth.forgot.submit')}
              </Button>
            </Form.Item>
          </Form>
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
