'use client';

import { ChangeEvent } from 'react';
import { useLanguage } from './LanguageContext';

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
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <span className="text-sm text-tortilla-700">{t('slider.label')}</span>
        <span className="text-3xl font-bold text-tortilla-700 tabular-nums">
          {value.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={value}
        onChange={handleSlider}
        disabled={disabled}
        className="w-full accent-tortilla-500"
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={value}
          onChange={handleNumber}
          disabled={disabled}
          className="text-input w-28 tabular-nums"
        />
        <span className="text-tortilla-700">/ 10</span>
      </div>
    </div>
  );
}
