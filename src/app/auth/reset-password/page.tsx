import { Suspense } from 'react';
import ResetPasswordPage from '@/views/ResetPasswordPage';

export const metadata = {
  title: 'Nueva contraseña · TortiWeb',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  );
}
