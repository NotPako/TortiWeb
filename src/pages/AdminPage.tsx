'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { TortillaManager } from '@/components/TortillaManager';
import {
  CREATE_TORTILLA_MUTATION,
  CURRENT_TORTILLA_QUERY,
  TORTILLAS_QUERY,
} from '@/graphql/operations';
import styles from './AdminPage.module.css';

const MAX_SIZE_BYTES = 4 * 1024 * 1024;

function fileToBase64(file: File): Promise<{ base64: string; type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const match = result.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        reject(new Error('No se pudo leer el archivo.'));
        return;
      }
      resolve({ type: match[1], base64: match[2] });
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('Lectura fallida'));
    reader.readAsDataURL(file);
  });
}

export default function AdminPage() {
  const { userName, isReady } = useUser();
  const { t } = useLanguage();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !userName) router.replace('/');
  }, [isReady, userName, router]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const [createTortilla, { loading }] = useMutation(
    CREATE_TORTILLA_MUTATION,
    {
      refetchQueries: [
        { query: CURRENT_TORTILLA_QUERY, variables: { userName } },
        { query: TORTILLAS_QUERY, variables: { userName } },
      ],
      awaitRefetchQueries: true,
    }
  );

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_SIZE_BYTES) {
      setFeedback(t('admin.errors.imageTooLarge'));
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(f);
    setFeedback(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!file) {
      setFeedback(t('admin.errors.imageRequired'));
      return;
    }
    if (!name.trim()) {
      setFeedback(t('admin.errors.nameRequired'));
      return;
    }
    if (!adminPassword) {
      setFeedback(t('admin.errors.passRequired'));
      return;
    }
    try {
      const { base64, type } = await fileToBase64(file);
      await createTortilla({
        variables: {
          input: {
            name: name.trim(),
            description: description.trim() || null,
            imageBase64: base64,
            imageContentType: type,
            date: date ? new Date(date).toISOString() : null,
            adminPassword,
          },
        },
      });
      setFeedback(t('admin.success'));
      setName('');
      setDescription('');
      setDate('');
      setFile(null);
      setAdminPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setFeedback(`${t('common.errorPrefix')}: ${msg}`);
    }
  }

  if (!isReady || !userName) return null;

  const isError = feedback?.startsWith(t('common.errorPrefix'));

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('admin.title')}</h1>
        <p className={styles.subtitle}>{t('admin.subtitle')}</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label className={styles.label} htmlFor="t-name">
              {t('admin.nameLabel')}
            </label>
            <input
              id="t-name"
              className={styles.input}
              placeholder={t('admin.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={styles.label} htmlFor="t-desc">
              {t('admin.descLabel')}
            </label>
            <textarea
              id="t-desc"
              className={styles.textarea}
              placeholder={t('admin.descPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className={styles.label} htmlFor="t-date">
              {t('admin.dateLabel')}
            </label>
            <input
              id="t-date"
              type="date"
              className={styles.input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className={styles.helper}>{t('admin.dateHelper')}</p>
          </div>

          <div>
            <label className={styles.label} htmlFor="t-file">
              {t('admin.fileLabel')}
            </label>
            <input
              id="t-file"
              type="file"
              accept="image/*"
              onChange={handleFile}
              className={styles.fileInput}
              required
            />
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt={t('admin.previewAlt')}
                className={styles.preview}
              />
            ) : null}
          </div>

          <div>
            <label className={styles.label} htmlFor="t-pass">
              {t('admin.passLabel')}
            </label>
            <input
              id="t-pass"
              type="password"
              className={styles.input}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={loading}
          >
            {loading ? t('admin.creating') : t('admin.submit')}
          </button>

          {feedback ? (
            <p
              className={
                isError
                  ? `${styles.feedback} ${styles.feedbackError}`
                  : `${styles.feedback} ${styles.feedbackSuccess}`
              }
            >
              {feedback}
            </p>
          ) : null}
        </form>
      </div>

      <TortillaManager />
    </div>
  );
}
