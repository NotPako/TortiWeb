'use client';

import { Tooltip } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';
import styles from './AchievementsGrid.module.css';

export type AchievementItem = {
  id: string;
  emoji: string;
  unlocked: boolean;
  progress?: number | null;
  goal?: number | null;
};

type Props = {
  achievements: AchievementItem[];
};

export function AchievementsGrid({ achievements }: Props) {
  const { t } = useLanguage();
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <section className={styles.wrap} aria-label={t('profile.achievementsTitle')}>
      <header className={styles.header}>
        <h3 className={styles.title}>{t('profile.achievementsTitle')}</h3>
        <span className={styles.count}>
          {unlockedCount} / {achievements.length}
        </span>
      </header>
      <div className={styles.grid}>
        {achievements.map((a) => {
          const titleKey = `achievement.${a.id}.title` as TranslationKey;
          const descKey = `achievement.${a.id}.description` as TranslationKey;
          const title = t(titleKey);
          const desc = t(descKey);
          // Solo tiene sentido enseñar avance si hay más de un paso.
          const showProgress =
            !a.unlocked && a.goal != null && a.goal > 1 && a.progress != null;
          const progressText = showProgress
            ? t('profile.achievementProgress', {
                n: a.progress ?? 0,
                goal: a.goal ?? 0,
              })
            : null;
          return (
            <Tooltip
              key={a.id}
              title={
                <span>
                  <strong>{title}</strong>
                  <br />
                  {desc}
                  {!a.unlocked ? (
                    <>
                      <br />
                      <em>
                        {progressText
                          ? `${t('profile.achievementLocked')} · ${progressText}`
                          : t('profile.achievementLocked')}
                      </em>
                    </>
                  ) : null}
                </span>
              }
            >
              <div
                className={
                  a.unlocked
                    ? styles.badge
                    : `${styles.badge} ${styles.badgeLocked}`
                }
                aria-label={title}
              >
                <span className={styles.emoji} aria-hidden>
                  {a.emoji}
                </span>
                <span className={styles.label}>{title}</span>
                {showProgress ? (
                  <span className={styles.progress}>
                    <span
                      className={styles.progressBar}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={a.goal ?? 0}
                      aria-valuenow={a.progress ?? 0}
                      aria-label={progressText ?? undefined}
                    >
                      <span
                        className={styles.progressFill}
                        style={{
                          width: `${((a.progress ?? 0) / (a.goal ?? 1)) * 100}%`,
                        }}
                      />
                    </span>
                    <span className={styles.progressText}>
                      {a.progress}/{a.goal}
                    </span>
                  </span>
                ) : null}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}
