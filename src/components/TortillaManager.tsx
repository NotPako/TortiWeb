'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  CURRENT_TORTILLA_QUERY,
  DELETE_TORTILLA_MUTATION,
  TORTILLAS_QUERY,
} from '@/graphql/operations';
import { useLanguage } from './LanguageContext';
import { useUser } from './UserContext';
import styles from './TortillaManager.module.css';

type Tortilla = {
  id: string;
  name: string;
  date: string;
  imageUrl: string;
  averageScore: number | null;
  voteCount: number;
};

export function TortillaManager() {
  const { t, locale } = useLanguage();
  const { userName } = useUser();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, loading, error } = useQuery<{ tortillas: Tortilla[] }>(
    TORTILLAS_QUERY,
    { variables: { userName } }
  );

  const [deleteTortilla] = useMutation(DELETE_TORTILLA_MUTATION, {
    refetchQueries: [
      { query: TORTILLAS_QUERY, variables: { userName } },
      { query: CURRENT_TORTILLA_QUERY, variables: { userName } },
    ],
    awaitRefetchQueries: true,
  });

  function formatDate(d: string) {
    try {
      return new Date(d).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  }

  async function handleDelete(tortilla: Tortilla) {
    setFeedback(null);
    const confirmText = t('admin.manage.confirm', { name: tortilla.name });
    if (!window.confirm(confirmText)) return;

    const password = window.prompt(t('admin.manage.passwordPrompt'));
    if (!password) return;

    setDeletingId(tortilla.id);
    try {
      await deleteTortilla({
        variables: { id: tortilla.id, adminPassword: password },
      });
      setFeedback(t('admin.manage.deleted'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  }

  const isError = feedback?.startsWith(t('common.errorPrefix'));
  const list = data?.tortillas ?? [];

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{t('admin.manage.title')}</h2>
      <p className={styles.subtitle}>{t('admin.manage.subtitle')}</p>

      {loading && !data ? (
        <p className={styles.statusText}>{t('common.loading')}</p>
      ) : error ? (
        <p className={styles.errorText}>
          {t('common.errorPrefix')}: {error.message}
        </p>
      ) : list.length === 0 ? (
        <p className={styles.emptyText}>{t('admin.manage.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {list.map((tortilla) => (
            <li key={tortilla.id} className={styles.item}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tortilla.imageUrl}
                alt={tortilla.name}
                className={styles.thumb}
                loading="lazy"
              />
              <div className={styles.itemBody}>
                <p className={styles.itemName}>{tortilla.name}</p>
                <p className={styles.itemMeta}>
                  {formatDate(tortilla.date)} ·{' '}
                  {tortilla.averageScore !== null
                    ? tortilla.averageScore.toFixed(2)
                    : '—'}{' '}
                  / 10 · {tortilla.voteCount}{' '}
                  {tortilla.voteCount === 1
                    ? t('history.voteSingular')
                    : t('history.votePlural')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(tortilla)}
                disabled={deletingId === tortilla.id}
                className={styles.deleteButton}
              >
                {deletingId === tortilla.id
                  ? t('admin.manage.deleting')
                  : t('admin.manage.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {feedback ? (
        <p
          className={
            isError
              ? `${styles.feedback} ${styles.feedbackError}`
              : `${styles.feedback} ${styles.feedbackSuccess}`
          }
        >
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
