import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DEFAULT_AFTER_LOGIN } from '@/lib/navigation';

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  if (session.user?.needsUsername) redirect('/auth/setup-username');
  redirect(DEFAULT_AFTER_LOGIN);
}
