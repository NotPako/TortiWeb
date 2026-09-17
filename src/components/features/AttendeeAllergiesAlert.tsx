'use client';

import { Alert, Tag } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import {
  hasAllergies,
  summarizeAllergens,
  type AllergenId,
} from '@/lib/allergens';
import { allergenLabel } from './AllergiesCard';
import styles from './AttendeeAllergiesAlert.module.css';

export type AttendeeWithAllergies = {
  userName: string;
  /** `null` si quien consulta no tiene permiso para verlas. */
  allergens: AllergenId[] | null;
  allergyNotes: string | null;
};

type Props = {
  attendees: AttendeeWithAllergies[];
};

/**
 * Aviso para quien cocina: qué no puede consumir cada apuntado, más un
 * resumen por alérgeno para calcular de un vistazo.
 */
export function AttendeeAllergiesAlert({ attendees }: Props) {
  const { t } = useLanguage();
  if (attendees.length === 0) return null;

  const affected = attendees.filter(hasAllergies);
  if (affected.length === 0) {
    return <p className={styles.none}>{t('event.admin.allergiesNone')}</p>;
  }

  const summary = summarizeAllergens(
    affected.map((a) => ({ userName: a.userName, allergens: a.allergens ?? [] }))
  );

  return (
    <Alert
      type="warning"
      showIcon
      className={styles.alert}
      message={t('event.admin.allergiesTitle')}
      description={
        <div className={styles.body}>
          <ul className={styles.list}>
            {affected.map((a) => (
              <li key={a.userName}>
                {a.allergens && a.allergens.length > 0 ? (
                  <p className={styles.line}>
                    {t('event.admin.allergiesCannotEat', {
                      name: a.userName,
                      list: a.allergens
                        .map((id) => allergenLabel(t, id).toLowerCase())
                        .join(', '),
                    })}
                  </p>
                ) : null}
                {a.allergyNotes ? (
                  <p className={styles.line}>
                    {t('event.admin.allergiesNotes', {
                      name: a.userName,
                      notes: a.allergyNotes,
                    })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {summary.length > 0 ? (
            <div className={styles.summary}>
              <span className={styles.summaryTitle}>
                {t('event.admin.allergiesSummary')}
              </span>
              <div className={styles.tags}>
                {summary.map(({ allergen, userNames }) => (
                  <Tag key={allergen} color="orange" title={userNames.join(', ')}>
                    {allergenLabel(t, allergen)} · {userNames.length}
                  </Tag>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  );
}
