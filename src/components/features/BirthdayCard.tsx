'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Button, Collapse, message } from 'antd';
import { useLanguage } from '@/components/LanguageContext';
import {
  BIRTHDAYS_TODAY_QUERY,
  MY_BIRTHDAY_QUERY,
  SET_BIRTHDAY_MUTATION,
} from '@/graphql/operations';
import {
  birthdayFromDraft,
  formatBirthday,
  isIncompleteBirthday,
  type Birthday,
  type BirthdayDraft,
} from '@/lib/birthday';
import { BirthdayField } from './BirthdayField';
import styles from './AllergiesCard.module.css';

type MyBirthday = {
  me: { id: string; birthday: Birthday | null } | null;
};

function sameBirthday(a: Birthday | null, b: Birthday | null): boolean {
  return a?.day === b?.day && a?.month === b?.month;
}

/** Cumpleaños del propio usuario, editable desde su perfil. */
export function BirthdayCard() {
  const { t, locale } = useLanguage();
  const { data } = useQuery<MyBirthday>(MY_BIRTHDAY_QUERY);
  const [save, { loading: saving }] = useMutation(SET_BIRTHDAY_MUTATION, {
    // Si lo pone para hoy, el gorro aparece sin recargar.
    refetchQueries: [{ query: BIRTHDAYS_TODAY_QUERY }],
  });

  const stored = data?.me ? data.me.birthday : undefined;
  const [draft, setDraft] = useState<BirthdayDraft | null>(null);

  useEffect(() => {
    if (stored === undefined) return;
    setDraft(stored ? { ...stored } : null);
  }, [stored]);

  if (stored === undefined) return null;

  const incomplete = isIncompleteBirthday(draft);
  const next = birthdayFromDraft(draft);
  const dirty = !incomplete && !sameBirthday(next, stored);

  async function handleSave() {
    try {
      await save({ variables: { birthday: next } });
      message.success(t('birthday.saved'));
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('birthday.error'));
    }
  }

  return (
    <Collapse
      className={styles.collapse}
      items={[
        {
          key: 'birthday',
          label: (
            <div className={styles.header}>
              <span className={styles.title}>🎂 {t('birthday.title')}</span>
              <span className={styles.summary}>
                {stored ? formatBirthday(stored, locale) : t('birthday.empty')}
              </span>
            </div>
          ),
          children: (
            <div className={styles.body}>
              <p className={styles.subtitle}>{t('birthday.hint')}</p>
              <BirthdayField value={draft} onChange={setDraft} />
              {incomplete ? (
                <p className={styles.subtitle}>{t('birthday.incomplete')}</p>
              ) : null}
              <div className={styles.actions}>
                <Button
                  type="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!dirty}
                >
                  {t('birthday.save')}
                </Button>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
