'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { VoteSlider } from '@/components/VoteSlider';
import {
  CAST_VOTE_MUTATION,
  CURRENT_TORTILLA_QUERY,
  TORTILLAS_QUERY,
} from '@/graphql/operations';

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

export default function VotePage() {
  const { userName, isReady } = useUser();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [score, setScore] = useState(7);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !userName) router.replace('/');
  }, [isReady, userName, router]);

  const { data, loading, error, refetch } = useQuery<{
    currentTortilla: Tortilla | null;
  }>(CURRENT_TORTILLA_QUERY, {
    variables: { userName },
    skip: !userName,
  });

  const tortilla = data?.currentTortilla ?? null;

  useEffect(() => {
    if (tortilla?.myVote) setScore(tortilla.myVote.score);
  }, [tortilla?.id, tortilla?.myVote]);

  const [castVote, { loading: voting }] = useMutation(CAST_VOTE_MUTATION, {
    refetchQueries: [
      { query: CURRENT_TORTILLA_QUERY, variables: { userName } },
      { query: TORTILLAS_QUERY, variables: { userName } },
    ],
    awaitRefetchQueries: true,
  });

  const formattedDate = useMemo(() => {
    if (!tortilla) return '';
    try {
      return new Date(tortilla.date).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return tortilla.date;
    }
  }, [tortilla, locale]);

  async function handleSubmit() {
    if (!tortilla || !userName) return;
    setFeedback(null);
    try {
      await castVote({
        variables: {
          input: { tortillaId: tortilla.id, userName, score },
        },
      });
      setFeedback(t('vote.success'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  if (!isReady || !userName) return null;

  if (loading && !data) {
    return <p className="text-tortilla-700">{t('common.loading')}</p>;
  }
  if (error) {
    return (
      <div className="card p-4 text-red-700">
        {t('vote.errorLoading')} {error.message}{' '}
        <button onClick={() => refetch()} className="underline">
          {t('common.retry')}
        </button>
      </div>
    );
  }
  if (!tortilla) {
    return (
      <div className="card p-6 text-center">
        <p className="text-lg font-semibold text-tortilla-800">
          {t('vote.empty.title')}
        </p>
        <p className="text-tortilla-700 mt-2">{t('vote.empty.subtitle')}</p>
      </div>
    );
  }

  const isError = feedback?.startsWith(t('common.errorPrefix'));

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tortilla.imageUrl}
          alt={tortilla.name}
          className="w-full aspect-square object-cover bg-tortilla-100"
        />
        <div className="p-4">
          <h2 className="text-xl font-bold text-tortilla-800">
            {tortilla.name}
          </h2>
          <p className="text-sm text-tortilla-600 capitalize">
            {formattedDate}
          </p>
          {tortilla.description ? (
            <p className="mt-2 text-tortilla-700">{tortilla.description}</p>
          ) : null}
          <div className="mt-3 flex items-center gap-4 text-sm text-tortilla-700">
            <span>
              {t('vote.average')}{' '}
              <strong>
                {tortilla.averageScore !== null
                  ? tortilla.averageScore.toFixed(2)
                  : '—'}
              </strong>
            </span>
            <span>
              {t('vote.votes')} <strong>{tortilla.voteCount}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="text-lg font-semibold text-tortilla-800">
          {t('vote.title')}
        </h3>
        {tortilla.myVote ? (
          <p className="text-sm text-tortilla-600">
            {t('vote.alreadyVoted', {
              score: tortilla.myVote.score.toFixed(1),
            })}
          </p>
        ) : (
          <p className="text-sm text-tortilla-600">{t('vote.helper')}</p>
        )}
        <VoteSlider value={score} onChange={setScore} disabled={voting} />
        <button
          className="btn-primary w-full"
          onClick={handleSubmit}
          disabled={voting}
        >
          {voting
            ? t('vote.submitting')
            : tortilla.myVote
              ? t('vote.update')
              : t('vote.send')}
        </button>
        {feedback ? (
          <p
            className={
              'text-sm ' + (isError ? 'text-red-700' : 'text-green-700')
            }
          >
            {feedback}
          </p>
        ) : null}
      </div>
    </div>
  );
}
