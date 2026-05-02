'use client';

import { ChangeEvent } from 'react';
import { useLanguage } from './LanguageContext';
import styles from './VoteSlider.module.css';

type Props = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function VoteSlider({ value, onChange, disabled }: Props) {
  const { t } = useLanguage();

  function handleSlider(e: ChangeEvent<HTMLInputElement>) {
    onChange(Number(e.target.value));
  }
  function handleNumber(e: ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    if (!Number.isFinite(v)) return;
    const clamped = Math.max(0, Math.min(10, v));
    onChange(Math.round(clamped * 10) / 10);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>{t('slider.label')}</span>
        <span className={styles.value}>{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={value}
        onChange={handleSlider}
        disabled={disabled}
        className={styles.range}
      />
      <div className={styles.numberRow}>
        <input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={value}
          onChange={handleNumber}
          disabled={disabled}
          className={styles.numberInput}
        />
        <span className={styles.suffix}>/ 10</span>
      </div>
    </div>
  );
}
