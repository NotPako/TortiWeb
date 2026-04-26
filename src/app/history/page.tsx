'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { TORTILLAS_QUERY } from '@/graphql/operations';

type Tortilla = {
  id: string;
  name: string;
  description?: string | null;
  date: string;
  imageUrl: string;
  averageScore: number | null;
  voteCount: number;
  myVote: { id: string; score: number } | null;
};

function ScoreBadge({
  score,
  noVotesLabel,
}: {
  score: number | null;
  noVotesLabel: string;
}) {
  if (score === null) {
    return (
      <span className="inline-block rounded-full bg-tortilla-50 text-tortilla-700 text-xs px-2 py-0.5">
        {noVotesLabel}
      </span>
    );
  }
  const color =
    score >= 8
      ? 'bg-green-100 text-green-800'
      : score >= 5
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800';
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ' +
        color
      }
    >
      {score.toFixed(2)} / 10
    </span>
  );
}

export default function HistoryPage() {
  const { userName, isReady } = useUser();
  const { t, locale } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !userName) router.replace('/');
  }, [isReady, userName, router]);

  const { data, loading, error } = useQuery<{ tortillas: Tortilla[] }>(
    TORTILLAS_QUERY,
    { variables: { userName }, skip: !userName }
  );

  if (!isReady || !userName) return null;

  if (loading && !data) {
    return <p className="text-tortilla-700">{t('history.loading')}</p>;
  }
  if (error) {
    return (
      <p className="text-red-700">
        {t('common.errorPrefix')}: {error.message}
      </p>
    );
  }

  const list = data?.tortillas ?? [];
  if (list.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-lg font-semibold text-tortilla-800">
          {t('history.empty.title')}
        </p>
        <p className="text-tortilla-700 mt-2">{t('history.empty.subtitle')}</p>
      </div>
    );
  }

  function formatDate(date: string) {
    try {
      return new Date(date).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-tortilla-800">
        {t('history.title')}
      </h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((tortilla) => (
          <article key={tortilla.id} className="card flex flex-col">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tortilla.imageUrl}
              alt={tortilla.name}
              className="w-full aspect-square object-cover bg-tortilla-100"
              loading="lazy"
            />
            <div className="p-4 flex-1 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-tortilla-800 leading-tight">
                    {tortilla.name}
                  </h2>
                  <p className="text-xs text-tortilla-600">
                    {formatDate(tortilla.date)}
                  </p>
                </div>
                <ScoreBadge
                  score={tortilla.averageScore}
                  noVotesLabel={t('history.noVotes')}
                />
              </div>
              {tortilla.description ? (
                <p className="text-sm text-tortilla-700 line-clamp-3">
                  {tortilla.description}
                </p>
              ) : null}
              <div className="mt-auto flex items-center justify-between text-xs text-tortilla-600">
                <span>
                  {tortilla.voteCount}{' '}
                  {tortilla.voteCount === 1
                    ? t('history.voteSingular')
                    : t('history.votePlural')}
                </span>
                {tortilla.myVote ? (
                  <span>
                    {t('history.yourScore')}{' '}
                    <strong className="text-tortilla-800">
                      {tortilla.myVote.score.toFixed(1)}
                    </strong>
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
