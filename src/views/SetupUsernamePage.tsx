'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/LanguageContext';
import { SET_USERNAME_MUTATION } from '@/graphql/operations';
import styles from './LoginPage.module.css';

export default function SetupUsernamePage() {
  const { t } = useLanguage();
  const { status, data, update } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState('');
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
      router.replace('/vote');
    }
  }, [status, data, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await setUsernameMutation({
        variables: { username: username.trim() },
      });
      await update();
      router.replace('/vote');
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
          {error ? <p className={styles.error}>{error}</p> : null}
          <button
            type="submit"
            className={styles.button}
            disabled={loading || !username.trim()}
          >
            {loading ? t('common.loading') : t('auth.setupUsername.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
