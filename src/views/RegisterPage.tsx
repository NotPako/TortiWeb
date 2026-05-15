'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { signIn, useSession } from 'next-auth/react';
import { useLanguage } from '@/components/LanguageContext';
import { REGISTER_MUTATION } from '@/graphql/operations';
import styles from './LoginPage.module.css';

export default function RegisterPage() {
  const { t } = useLanguage();
  const { status, data } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register({
        variables: {
          input: {
            username: username.trim(),
            email: email.trim(),
            password,
          },
        },
      });
      const res = await signIn('credentials', {
        username: username.trim(),
        password,
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

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label htmlFor="username" className={styles.label}>
              {t('auth.usernameLabel')}
            </label>
            <input
              id="username"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="email" className={styles.label}>
              {t('auth.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className={styles.label}>
              {t('auth.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button
            type="submit"
            className={styles.button}
            disabled={
              loading || !username.trim() || !email.trim() || password.length < 8
            }
          >
            {loading ? t('common.loading') : t('auth.register.submit')}
          </button>
        </form>

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
