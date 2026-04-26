export const SUPPORTED_LANGUAGES = ['es', 'ca'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  es: 'Español',
  ca: 'Català',
};

export const LANGUAGE_SHORT_LABELS: Record<Language, string> = {
  es: 'ES',
  ca: 'CA',
};

export const LOCALE_TAG: Record<Language, string> = {
  es: 'es-ES',
  ca: 'ca-ES',
};

const es = {
  'app.title': 'TortiWeb',
  'app.metadataTitle': 'TortiWeb · Las tortillas del miércoles',
  'app.metadataDescription':
    'Vota la tortilla de cada miércoles y consulta las puntuaciones medias del histórico.',
  'app.subtitle':
    'Cada miércoles, una tortilla diferente. Identifícate con tu nombre para votar la del día y ver el historial.',

  'nav.vote': 'Votar',
  'nav.history': 'Historial',
  'nav.admin': 'Admin',
  'nav.greetingPrefix': 'Hola,',
  'nav.signOut': 'Salir',
  'nav.signIn': 'Identificarse',

  'login.nameLabel': 'Tu nombre',
  'login.namePlaceholder': 'Ej: Pako',
  'login.submit': 'Entrar',

  'common.loading': 'Cargando…',
  'common.retry': 'reintentar',
  'common.errorPrefix': 'Error',

  'vote.errorLoading': 'Error cargando la tortilla:',
  'vote.empty.title': 'Aún no hay tortilla para votar.',
  'vote.empty.subtitle':
    'Pídele al admin que añada la del miércoles desde la sección Admin.',
  'vote.average': 'Media:',
  'vote.votes': 'Votos:',
  'vote.title': 'Vota la tortilla de hoy',
  'vote.alreadyVoted':
    'Ya votaste con un {score}. Puedes actualizar tu nota cuando quieras.',
  'vote.helper':
    'Mueve el slider o escribe la nota directamente. Decimales permitidos (de 0 a 10).',
  'vote.submitting': 'Enviando…',
  'vote.update': 'Actualizar voto',
  'vote.send': 'Enviar voto',
  'vote.success': '¡Voto registrado!',

  'history.title': 'Historial de tortillas',
  'history.loading': 'Cargando histórico…',
  'history.empty.title': 'Todavía no hay tortillas registradas.',
  'history.empty.subtitle':
    'Cuando se añada la primera, aparecerá aquí con su nota media.',
  'history.noVotes': 'Sin votos',
  'history.voteSingular': 'voto',
  'history.votePlural': 'votos',
  'history.yourScore': 'Tu nota:',

  'admin.title': 'Crear tortilla del miércoles',
  'admin.subtitle':
    'Solo el admin puede registrar nuevas tortillas. La contraseña se configura en el archivo .env.local.',
  'admin.nameLabel': 'Nombre de la tortilla',
  'admin.namePlaceholder': 'Ej: Tortilla de patata con cebolla',
  'admin.descLabel': 'Descripción (opcional)',
  'admin.descPlaceholder': 'Ingredientes, anécdotas, etc.',
  'admin.dateLabel': 'Fecha (opcional)',
  'admin.dateHelper': 'Si la dejas vacía se usará la fecha actual.',
  'admin.fileLabel': 'Foto de la tortilla',
  'admin.previewAlt': 'Vista previa',
  'admin.passLabel': 'Contraseña de admin',
  'admin.creating': 'Creando…',
  'admin.submit': 'Crear tortilla',
  'admin.success': '¡Tortilla creada!',
  'admin.errors.imageTooLarge': 'Error: la imagen no puede superar 4 MB.',
  'admin.errors.imageRequired': 'Error: selecciona una imagen.',
  'admin.errors.nameRequired': 'Error: el nombre es obligatorio.',
  'admin.errors.passRequired': 'Error: introduce la contraseña de admin.',

  'admin.manage.title': 'Tortillas existentes',
  'admin.manage.subtitle':
    'Aquí puedes eliminar cualquier tortilla previa. Al borrarla, también se eliminarán todos sus votos.',
  'admin.manage.empty': 'Aún no hay tortillas registradas.',
  'admin.manage.delete': 'Eliminar',
  'admin.manage.deleting': 'Eliminando…',
  'admin.manage.confirm':
    '¿Seguro que quieres eliminar "{name}"? Esta acción no se puede deshacer y borrará también sus votos.',
  'admin.manage.passwordPrompt': 'Introduce la contraseña de admin',
  'admin.manage.deleted': '¡Tortilla eliminada!',

  'slider.label': 'Tu nota',

  'lang.label': 'Idioma',
} as const;

type DictKey = keyof typeof es;

const ca: Record<DictKey, string> = {
  'app.title': 'TortiWeb',
  'app.metadataTitle': 'TortiWeb · Les truites del dimecres',
  'app.metadataDescription':
    "Vota la truita de cada dimecres i consulta les puntuacions mitjanes de l'històric.",
  'app.subtitle':
    "Cada dimecres, una truita diferent. Identifica't amb el teu nom per votar la del dia i veure l'històric.",

  'nav.vote': 'Votar',
  'nav.history': 'Històric',
  'nav.admin': 'Admin',
  'nav.greetingPrefix': 'Hola,',
  'nav.signOut': 'Sortir',
  'nav.signIn': 'Identificar-se',

  'login.nameLabel': 'El teu nom',
  'login.namePlaceholder': 'Ex: Pako',
  'login.submit': 'Entrar',

  'common.loading': 'Carregant…',
  'common.retry': 'tornar a intentar',
  'common.errorPrefix': 'Error',

  'vote.errorLoading': 'Error carregant la truita:',
  'vote.empty.title': 'Encara no hi ha truita per votar.',
  'vote.empty.subtitle':
    "Demana a l'admin que afegeixi la del dimecres des de la secció Admin.",
  'vote.average': 'Mitjana:',
  'vote.votes': 'Vots:',
  'vote.title': "Vota la truita d'avui",
  'vote.alreadyVoted':
    'Ja has votat amb un {score}. Pots actualitzar la teva nota quan vulguis.',
  'vote.helper':
    'Mou el slider o escriu la nota directament. Decimals permesos (de 0 a 10).',
  'vote.submitting': 'Enviant…',
  'vote.update': 'Actualitzar vot',
  'vote.send': 'Enviar vot',
  'vote.success': 'Vot registrat!',

  'history.title': 'Històric de truites',
  'history.loading': 'Carregant històric…',
  'history.empty.title': 'Encara no hi ha truites registrades.',
  'history.empty.subtitle':
    "Quan s'afegeixi la primera, apareixerà aquí amb la seva nota mitjana.",
  'history.noVotes': 'Sense vots',
  'history.voteSingular': 'vot',
  'history.votePlural': 'vots',
  'history.yourScore': 'La teva nota:',

  'admin.title': 'Crear truita del dimecres',
  'admin.subtitle':
    "Només l'admin pot registrar noves truites. La contrasenya es configura al fitxer .env.local.",
  'admin.nameLabel': 'Nom de la truita',
  'admin.namePlaceholder': 'Ex: Truita de patata amb ceba',
  'admin.descLabel': 'Descripció (opcional)',
  'admin.descPlaceholder': 'Ingredients, anècdotes, etc.',
  'admin.dateLabel': 'Data (opcional)',
  'admin.dateHelper': "Si la deixes buida s'utilitzarà la data actual.",
  'admin.fileLabel': 'Foto de la truita',
  'admin.previewAlt': 'Vista prèvia',
  'admin.passLabel': "Contrasenya d'admin",
  'admin.creating': 'Creant…',
  'admin.submit': 'Crear truita',
  'admin.success': 'Truita creada!',
  'admin.errors.imageTooLarge': 'Error: la imatge no pot superar 4 MB.',
  'admin.errors.imageRequired': 'Error: selecciona una imatge.',
  'admin.errors.nameRequired': 'Error: el nom és obligatori.',
  'admin.errors.passRequired': "Error: introdueix la contrasenya d'admin.",

  'admin.manage.title': 'Truites existents',
  'admin.manage.subtitle':
    'Aquí pots eliminar qualsevol truita anterior. En esborrar-la, també s\'eliminaran tots els seus vots.',
  'admin.manage.empty': 'Encara no hi ha truites registrades.',
  'admin.manage.delete': 'Eliminar',
  'admin.manage.deleting': 'Eliminant…',
  'admin.manage.confirm':
    'Segur que vols eliminar "{name}"? Aquesta acció no es pot desfer i també esborrarà els seus vots.',
  'admin.manage.passwordPrompt': "Introdueix la contrasenya d'admin",
  'admin.manage.deleted': 'Truita eliminada!',

  'slider.label': 'La teva nota',

  'lang.label': 'Idioma',
};

export const dictionaries: Record<Language, Record<DictKey, string>> = {
  es,
  ca,
};

export type TranslationKey = DictKey;

export function translate(
  lang: Language,
  key: DictKey,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[lang] ?? dictionaries.es;
  let str: string = dict[key] ?? dictionaries.es[key] ?? (key as string);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}
