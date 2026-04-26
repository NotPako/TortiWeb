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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-tortilla-800 mb-1">
          {t('admin.title')}
        </h1>
        <p className="text-sm text-tortilla-600 mb-6">{t('admin.subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="t-name">
              {t('admin.nameLabel')}
            </label>
            <input
              id="t-name"
              className="text-input"
              placeholder={t('admin.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="t-desc">
              {t('admin.descLabel')}
            </label>
            <textarea
              id="t-desc"
              className="text-input min-h-24"
              placeholder={t('admin.descPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="t-date">
              {t('admin.dateLabel')}
            </label>
            <input
              id="t-date"
              type="date"
              className="text-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="text-xs text-tortilla-600 mt-1">
              {t('admin.dateHelper')}
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="t-file">
              {t('admin.fileLabel')}
            </label>
            <input
              id="t-file"
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="block w-full text-sm text-tortilla-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-tortilla-100 file:text-tortilla-800 hover:file:bg-tortilla-200"
              required
            />
            {previewUrl ? (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={t('admin.previewAlt')}
                  className="w-40 h-40 object-cover rounded-xl border border-tortilla-100"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="t-pass">
              {t('admin.passLabel')}
            </label>
            <input
              id="t-pass"
              type="password"
              className="text-input"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? t('admin.creating') : t('admin.submit')}
          </button>

          {feedback ? (
            <p
              className={
                'text-sm ' + (isError ? 'text-red-700' : 'text-green-700')
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
