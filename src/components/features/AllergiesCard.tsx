'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Alert, Button, Checkbox, Collapse, Input, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useLanguage } from '@/components/LanguageContext';
import {
  ALLERGENS,
  MAX_ALLERGY_NOTES_LENGTH,
  normalizeAllergens,
  type AllergenId,
} from '@/lib/allergens';
import type { TranslationKey } from '@/lib/i18n';
import {
  MY_ALLERGIES_QUERY,
  SET_ALLERGIES_MUTATION,
} from '@/graphql/operations';
import styles from './AllergiesCard.module.css';

type MyAllergies = {
  me: {
    id: string;
    allergens: AllergenId[];
    allergyNotes: string | null;
  } | null;
};

/** Traduce un id de alérgeno. Compartido con el aviso del panel de admin. */
export function allergenLabel(
  t: (key: TranslationKey) => string,
  id: AllergenId
): string {
  return t(`allergen.${id}` as TranslationKey);
}

/**
 * Alergias del propio usuario, editables desde su perfil. Solo se monta en el
 * perfil propio: es un dato de salud y nunca se muestra en perfiles ajenos.
 */
export function AllergiesCard() {
  const { t } = useLanguage();
  const { data } = useQuery<MyAllergies>(MY_ALLERGIES_QUERY);
  const [save, { loading: saving }] = useMutation(SET_ALLERGIES_MUTATION);

  const stored = data?.me ?? null;
  const [selected, setSelected] = useState<AllergenId[]>([]);
  const [notes, setNotes] = useState('');

  // Al cargar (o tras guardar, cuando Apollo actualiza la caché) el formulario
  // refleja lo guardado.
  useEffect(() => {
    if (!stored) return;
    setSelected(stored.allergens);
    setNotes(stored.allergyNotes ?? '');
  }, [stored]);

  const dirty = useMemo(() => {
    if (!stored) return false;
    const current = normalizeAllergens(selected).join(',');
    return (
      current !== stored.allergens.join(',') ||
      notes.trim() !== (stored.allergyNotes ?? '')
    );
  }, [stored, selected, notes]);

  const summary = useMemo(() => {
    if (!stored) return '';
    const names = stored.allergens.map((id) => allergenLabel(t, id));
    if (stored.allergyNotes) names.push(stored.allergyNotes);
    return names.join(' · ');
  }, [stored, t]);

  async function handleSave() {
    try {
      await save({
        variables: {
          input: {
            allergens: normalizeAllergens(selected),
            allergyNotes: notes.trim() || null,
          },
        },
      });
      message.success(t('allergies.saved'));
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('allergies.error'));
    }
  }

  if (!stored) return null;

  return (
    <Collapse
      className={styles.collapse}
      items={[
        {
          key: 'allergies',
          label: (
            <div className={styles.header}>
              <span className={styles.title}>{t('allergies.title')}</span>
              {summary ? (
                <span className={styles.summary}>{summary}</span>
              ) : null}
            </div>
          ),
          children: (
            <div className={styles.body}>
              <p className={styles.subtitle}>{t('allergies.subtitle')}</p>

              <Checkbox.Group
                className={styles.grid}
                value={selected}
                onChange={(values) => setSelected(values as AllergenId[])}
                options={ALLERGENS.map((id) => ({
                  value: id,
                  label: allergenLabel(t, id),
                }))}
              />

              <label className={styles.notesLabel} htmlFor="allergy-notes">
                {t('allergies.notesLabel')}
              </label>
              <Input.TextArea
                id="allergy-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('allergies.notesPlaceholder')}
                maxLength={MAX_ALLERGY_NOTES_LENGTH}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />

              <Alert
                type="info"
                showIcon
                icon={<LockOutlined />}
                message={t('allergies.privacy')}
              />

              <div className={styles.actions}>
                <Button
                  type="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!dirty}
                >
                  {t('allergies.save')}
                </Button>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
