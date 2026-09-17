'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Button } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import { ProfileHeader } from '@/components/features/ProfileHeader';
import { AllergiesCard } from '@/components/features/AllergiesCard';
import { ME_QUERY } from '@/graphql/operations';
import { withCallbackUrl } from '@/lib/navigation';
import styles from './AccountPage.module.css';

/**
 * Datos de la cuenta, comunes a todos los grupos: foto y alergias. Las
 * estadísticas no están aquí porque son por grupo (`/g/<slug>/profile`).
 */
export default function AccountPage() {
  const { userName, userImage, isReady } = useUser();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !userName) {
      router.replace(withCallbackUrl('/login', '/profile'));
    }
  }, [isReady, userName, router]);

  const { data } = useQuery<{ me: { imageUrl: string | null } | null }>(
    ME_QUERY,
    { skip: !userName }
  );

  if (!isReady || !userName) return null;

  return (
    <div className={styles.wrap}>
      <ProfileHeader
        userName={userName}
        imageUrl={data?.me?.imageUrl ?? userImage}
        title={t('account.title')}
        editable
      >
        <p className={styles.hint}>{t('account.statsHint')}</p>
        <Link href="/groups">
          <Button size="small" type="link" icon={<TeamOutlined />}>
            {t('nav.groups')}
          </Button>
        </Link>
      </ProfileHeader>
      <AllergiesCard />
    </div>
  );
}
