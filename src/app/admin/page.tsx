import { redirect } from 'next/navigation';

/** Ruta anterior a los grupos: ahora cada sección vive en /g/<slug>/…. */
export default function Page() {
  redirect('/groups');
}
