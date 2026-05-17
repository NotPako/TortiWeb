'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@apollo/client';
import { useSession } from 'next-auth/react';
import {
  ME_QUERY,
  MY_STATS_QUERY,
  SET_PROFILE_IMAGE_MUTATION,
} from '@/graphql/operations';

const MAX_BYTES = 2 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Read error'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

type UseProfileImageUploadResult = {
  uploading: boolean;
  error: string | null;
  upload: (file: File) => Promise<boolean>;
};

/**
 * Encapsula la subida de avatar: validación, conversión a base64, mutación y
 * refresco de la sesión de NextAuth para que el resto de la app vea el cambio.
 */
export function useProfileImageUpload(): UseProfileImageUploadResult {
  const { update } = useSession();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setProfileImage] = useMutation<{
    setProfileImage: { imageUrl: string | null };
  }>(SET_PROFILE_IMAGE_MUTATION, {
    refetchQueries: [{ query: MY_STATS_QUERY }, { query: ME_QUERY }],
    awaitRefetchQueries: true,
  });

  const upload = useCallback(
    async (file: File): Promise<boolean> => {
      setError(null);
      if (!file.type.startsWith('image/')) {
        setError('El archivo debe ser una imagen.');
        return false;
      }
      if (file.size > MAX_BYTES) {
        setError('La imagen no puede superar 2 MB.');
        return false;
      }
      setUploading(true);
      try {
        const base64 = await fileToBase64(file);
        const result = await setProfileImage({
          variables: {
            input: { imageBase64: base64, imageContentType: file.type },
          },
        });
        // Fuerza al jwt callback a recargar de DB y propagar la nueva imagen.
        await update({ image: result.data?.setProfileImage.imageUrl ?? null });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al subir la imagen.');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [setProfileImage, update]
  );

  return { uploading, error, upload };
}
