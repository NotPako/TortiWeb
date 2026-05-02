'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { userName, isReady, signIn } = useUser();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (isReady && userName) {
      router.replace('/vote');
    }
  }, [isReady, userName, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    signIn(name);
    router.push('/vote');
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
        <p className={styles.subtitle}>{t('app.subtitle')}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label htmlFor="name" className={styles.label}>
              {t('login.nameLabel')}
            </label>
            <input
              id="name"
              className={styles.input}
              placeholder={t('login.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className={styles.button}
            disabled={!name.trim()}
          >
            {t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
