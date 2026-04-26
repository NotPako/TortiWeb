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
    <section className="card p-6">
      <h2 className="text-xl font-bold text-tortilla-800 mb-1">
        {t('admin.manage.title')}
      </h2>
      <p className="text-sm text-tortilla-600 mb-4">
        {t('admin.manage.subtitle')}
      </p>

      {loading && !data ? (
        <p className="text-tortilla-700">{t('common.loading')}</p>
      ) : error ? (
        <p className="text-red-700">
          {t('common.errorPrefix')}: {error.message}
        </p>
      ) : list.length === 0 ? (
        <p className="text-tortilla-600">{t('admin.manage.empty')}</p>
      ) : (
        <ul className="divide-y divide-tortilla-100">
          {list.map((tortilla) => (
            <li
              key={tortilla.id}
              className="py-3 flex items-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tortilla.imageUrl}
                alt={tortilla.name}
                className="w-14 h-14 rounded-lg object-cover bg-tortilla-100 flex-shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-tortilla-800 truncate">
                  {tortilla.name}
                </p>
                <p className="text-xs text-tortilla-600">
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
                className="btn-secondary !text-red-700 !border-red-200 hover:!bg-red-50 text-sm"
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
            'text-sm mt-3 ' + (isError ? 'text-red-700' : 'text-green-700')
          }
        >
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
