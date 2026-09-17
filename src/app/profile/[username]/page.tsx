import { redirect } from 'next/navigation';

/** Los perfiles ajenos ahora solo se ven dentro de un grupo compartido. */
export default function Page() {
  redirect('/groups');
}
