import { ReactNode } from 'react';
import { GroupGate } from '@/components/features/GroupGate';

export default function GroupLayout({ children }: { children: ReactNode }) {
  return <GroupGate>{children}</GroupGate>;
}
