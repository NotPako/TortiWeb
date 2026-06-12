'use client';

import { useLanguage } from '@/components/LanguageContext';
import type { Reaction } from '@/models/Vote';
import styles from './ReactionPicker.module.css';

type TranslationKey =
  | 'reaction.fire'
  | 'reaction.yummy'
  | 'reaction.meh'
  | 'reaction.cringe';

const OPTIONS: { value: Reaction; emoji: string; labelKey: TranslationKey }[] =
  [
    { value: 'fire', emoji: '🔥', labelKey: 'reaction.fire' },
    { value: 'yummy', emoji: '😋', labelKey: 'reaction.yummy' },
    { value: 'meh', emoji: '😐', labelKey: 'reaction.meh' },
    { value: 'cringe', emoji: '😬', labelKey: 'reaction.cringe' },
  ];

type Props = {
  value: Reaction | null;
  onChange: (r: Reaction | null) => void;
  disabled?: boolean;
};

export function ReactionPicker({ value, onChange, disabled = false }: Props) {
  const { t } = useLanguage();

  function handleClick(r: Reaction) {
    if (disabled) return;
    onChange(value === r ? null : r);
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.eyebrow}>{t('reaction.label')}</p>
      <div className={styles.chips}>
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          const className = active
            ? `${styles.chip} ${styles.chipActive}`
            : styles.chip;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => handleClick(opt.value)}
              aria-pressed={active}
              className={className}
            >
              <span className={styles.emoji}>{opt.emoji}</span>
              <span className={styles.label}>{t(opt.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
