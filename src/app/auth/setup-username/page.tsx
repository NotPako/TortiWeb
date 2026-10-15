import { Suspense } from 'react';
import SetupUsernamePage from '@/views/SetupUsernamePage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SetupUsernamePage />
    </Suspense>
  );
}
