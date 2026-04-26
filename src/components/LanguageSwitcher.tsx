'use client';

import {
  LANGUAGE_SHORT_LABELS,
  Language,
  SUPPORTED_LANGUAGES,
} from '@/lib/i18n';
import { useLanguage } from './LanguageContext';

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      className="flex items-center rounded-lg border border-tortilla-200 bg-white overflow-hidden text-xs"
    >
      {SUPPORTED_LANGUAGES.map((l: Language) => {
        const active = l === lang;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            className={
              'px-2 py-1 transition-colors ' +
              (active
                ? 'bg-tortilla-500 text-white'
                : 'text-tortilla-700 hover:bg-tortilla-50')
            }
          >
            {LANGUAGE_SHORT_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
