import { Suspense } from 'react';
import RegisterPage from '@/views/RegisterPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterPage />
    </Suspense>
  );
}
