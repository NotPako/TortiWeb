'use client';

import { ReactNode } from 'react';
import { Button, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload/interface';
import { useLanguage } from '@/components/LanguageContext';
import { useProfileImageUpload } from '@/hooks/useProfileImageUpload';
import { UserChip } from './UserChip';
import styles from './ProfileHeader.module.css';

type Props = {
  userName: string;
  imageUrl: string | null | undefined;
  title: string;
  /** Muestra el botón para cambiar la foto (solo en el perfil propio). */
  editable?: boolean;
  /** Contenido extra bajo el título (p. ej. enlaces). */
  children?: ReactNode;
};

/** Cabecera de perfil: avatar ampliable, título y, si es el propio, subir foto. */
export function ProfileHeader({
  userName,
  imageUrl,
  title,
  editable = false,
  children,
}: Props) {
  const { t } = useLanguage();
  const { upload, uploading } = useProfileImageUpload();

  async function handleBeforeUpload(file: RcFile): Promise<boolean> {
    const ok = await upload(file as File);
    if (ok) {
      message.success(t('profile.uploadSuccess'));
    } else {
      message.error(t('profile.uploadError'));
    }
    return false; // Evita la subida automática de antd; ya la hizo el hook.
  }

  return (
    <header className={styles.header}>
      {/* Ya estamos en el perfil: en vez de enlazar, amplía la foto. */}
      <UserChip
        userName={userName}
        imageUrl={imageUrl}
        size={88}
        showName={false}
        href={null}
        previewable
        previewLabel={t('profile.viewPhoto')}
      />
      <div className={styles.headerText}>
        <h1 className={styles.title}>{title}</h1>
        {editable ? (
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleBeforeUpload}
            disabled={uploading}
          >
            <Button size="small" icon={<UploadOutlined />} loading={uploading}>
              {t('profile.changePhoto')}
            </Button>
          </Upload>
        ) : null}
        {children}
      </div>
    </header>
  );
}
