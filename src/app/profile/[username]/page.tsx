import ProfilePage from '@/views/ProfilePage';

type Params = { username: string };

export const metadata = {
  title: 'Perfil · TortiWeb',
};

export default function Page({ params }: { params: Params }) {
  return <ProfilePage username={decodeURIComponent(params.username)} />;
}
