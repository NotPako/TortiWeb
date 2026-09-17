import { redirect } from 'next/navigation';
import { groupPath } from '@/lib/groups';

export default function Page({ params }: { params: { slug: string } }) {
  redirect(groupPath(decodeURIComponent(params.slug), 'vote'));
}
