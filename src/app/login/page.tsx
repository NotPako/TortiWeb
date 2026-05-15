import { Suspense } from 'react';
import LoginPage from '@/views/LoginPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
