import JoinGroupPage from '@/views/JoinGroupPage';

export const metadata = {
  title: 'Unirse a un grupo · TortiWeb',
};

export default function Page({ params }: { params: { code: string } }) {
  return <JoinGroupPage code={decodeURIComponent(params.code)} />;
}
