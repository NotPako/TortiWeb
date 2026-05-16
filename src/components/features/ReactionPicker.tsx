'use client';

import { Button, Space } from 'antd';
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
    onChange(value === r ? null : r);
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>{t('reaction.label')}</p>
      <Space.Compact block>
        {OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type={value === opt.value ? 'primary' : 'default'}
            disabled={disabled}
            onClick={() => handleClick(opt.value)}
            aria-pressed={value === opt.value}
            className={styles.btn}
          >
            <span className={styles.emoji}>{opt.emoji}</span>
            <span className={styles.btnLabel}>{t(opt.labelKey)}</span>
          </Button>
        ))}
      </Space.Compact>
    </div>
  );
}
