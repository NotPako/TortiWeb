'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Pagination, Skeleton } from 'antd';
import {
  CURRENT_TORTILLA_QUERY,
  DELETE_TORTILLA_MUTATION,
  TORTILLAS_QUERY,
} from '@/graphql/operations';
import { useLanguage } from './LanguageContext';
import styles from './TortillaManager.module.css';

type Tortilla = {
  id: string;
  name: string;
  date: string;
  imageUrl: string;
  averageScore: number | null;
  voteCount: number;
};

const PAGE_SIZE = 8;

export function TortillaManager() {
  const { t, locale } = useLanguage();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, loading, error } = useQuery<{ tortillas: Tortilla[] }>(
    TORTILLAS_QUERY
  );

  const [deleteTortilla] = useMutation(DELETE_TORTILLA_MUTATION, {
    refetchQueries: [
      { query: TORTILLAS_QUERY },
      { query: CURRENT_TORTILLA_QUERY },
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

    setDeletingId(tortilla.id);
    try {
      await deleteTortilla({
        variables: { id: tortilla.id },
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

  // Clamp: al borrar la última tortilla de la última página, retrocede sola.
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedList = useMemo(
    () => list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [list, currentPage]
  );

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{t('admin.manage.title')}</h2>
      <p className={styles.subtitle}>{t('admin.manage.subtitle')}</p>

      {loading && !data ? (
        <Skeleton active avatar paragraph={{ rows: 3 }} />
      ) : error ? (
        <p className={styles.errorText}>
          {t('common.errorPrefix')}: {error.message}
        </p>
      ) : list.length === 0 ? (
        <p className={styles.emptyText}>{t('admin.manage.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {pagedList.map((tortilla) => (
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

      {list.length > PAGE_SIZE ? (
        <div className={styles.paginationRow}>
          <Pagination
            current={currentPage}
            pageSize={PAGE_SIZE}
            total={list.length}
            onChange={setPage}
            showSizeChanger={false}
            size="small"
          />
        </div>
      ) : null}

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
