'use client';

import { useMemo } from 'react';
import { Select } from 'antd';
import type { Rule } from 'antd/es/form';
import { useLanguage } from '@/components/LanguageContext';
import {
  isIncompleteBirthday,
  maxDayOfMonth,
  type BirthdayDraft,
} from '@/lib/birthday';
import type { TranslationKey } from '@/lib/i18n';
import styles from './BirthdayField.module.css';

type Props = {
  /** Lo inyecta `Form.Item`; también se puede usar suelto. */
  value?: BirthdayDraft | null;
  onChange?: (value: BirthdayDraft) => void;
  id?: string;
};

/** Regla de `Form.Item`: vacío vale, a medias no. */
export function birthdayRule(t: (key: TranslationKey) => string): Rule {
  return {
    validator: (_, value: BirthdayDraft | null | undefined) =>
      isIncompleteBirthday(value)
        ? Promise.reject(new Error(t('birthday.incomplete')))
        : Promise.resolve(),
  };
}

/** Selector de día + mes (sin año). Ambos opcionales y borrables. */
export function BirthdayField({ value, onChange, id }: Props) {
  const { t, locale } = useLanguage();
  const day = value?.day ?? null;
  const month = value?.month ?? null;

  const monthOptions = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, {
      month: 'long',
      timeZone: 'UTC',
    });
    return Array.from({ length: 12 }, (_, i) => {
      const name = fmt.format(Date.UTC(2000, i, 1));
      return {
        value: i + 1,
        label: name.charAt(0).toUpperCase() + name.slice(1),
      };
    });
  }, [locale]);

  const dayOptions = useMemo(
    () =>
      Array.from({ length: maxDayOfMonth(month ?? 1) }, (_, i) => ({
        value: i + 1,
        label: String(i + 1),
      })),
    [month]
  );

  return (
    <div className={styles.row}>
      <Select<number>
        id={id}
        className={styles.day}
        placeholder={t('birthday.day')}
        aria-label={t('birthday.day')}
        options={dayOptions}
        value={day ?? undefined}
        onChange={(d) => onChange?.({ day: d ?? null, month })}
        allowClear
        showSearch
      />
      <Select<number>
        className={styles.month}
        placeholder={t('birthday.month')}
        aria-label={t('birthday.month')}
        options={monthOptions}
        value={month ?? undefined}
        onChange={(m) => {
          const nextMonth = m ?? null;
          // 31 de enero → febrero: el día ya no existe, hay que volver a elegirlo.
          const keepDay =
            day != null && (nextMonth == null || day <= maxDayOfMonth(nextMonth));
          onChange?.({ day: keepDay ? day : null, month: nextMonth });
        }}
        allowClear
        showSearch
        optionFilterProp="label"
      />
    </div>
  );
}
