'use client';

import {
  LANGUAGE_SHORT_LABELS,
  Language,
  SUPPORTED_LANGUAGES,
} from '@/lib/i18n';
import { useLanguage } from './LanguageContext';
import styles from './LanguageSwitcher.module.css';

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div role="group" aria-label={t('lang.label')} className={styles.group}>
      {SUPPORTED_LANGUAGES.map((l: Language) => {
        const active = l === lang;
        const className = active
          ? `${styles.button} ${styles.buttonActive}`
          : styles.button;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            className={className}
          >
            {LANGUAGE_SHORT_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
