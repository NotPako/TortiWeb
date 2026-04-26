'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';

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
    <div className="max-w-md mx-auto mt-10">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-3xl" aria-hidden>
            🍳
          </span>
          <h1 className="text-2xl font-bold text-tortilla-800">
            {t('app.title')}
          </h1>
        </div>
        <p className="text-tortilla-700 mb-6">{t('app.subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="field-label">
              {t('login.nameLabel')}
            </label>
            <input
              id="name"
              className="text-input"
              placeholder={t('login.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={!name.trim()}
          >
            {t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
