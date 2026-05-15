import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user?.needsUsername) redirect('/auth/setup-username');
  redirect('/vote');
}
