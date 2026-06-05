'use client';

import { Tooltip } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';
import styles from './AchievementsGrid.module.css';

export type AchievementItem = {
  id: string;
  emoji: string;
  unlocked: boolean;
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
                      <em>{t('profile.achievementLocked')}</em>
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
              </div>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}
