/**
 * Plazas de una convocatoria: tope, cola de solicitudes y revisión del admin.
 *
 * Reglas:
 * - Con hueco, quien se apunta entra directamente.
 * - Lleno, se envía una solicitud que queda en cola (por orden de llegada).
 * - Si alguien se desapunta, la solicitud más antigua entra sola.
 * - El admin puede aprobar una solicitud aunque se pase del tope (13/12).
 * - Si la rechaza, esa persona ya no puede pedir ni apuntarse a esta
 *   convocatoria.
 *
 * Funciones puras sobre un estado plano: el resolver carga el documento,
 * aplica la operación y guarda. Mutan `state` y devuelven el resultado.
 */

export const DEFAULT_EVENT_CAPACITY = 12;
export const MIN_EVENT_CAPACITY = 1;
export const MAX_EVENT_CAPACITY = 100;

export type SpotPerson = {
  /** Id de la cuenta (string para no depender de Mongoose aquí). */
  user: string;
  userKey: string;
  userName: string;
};

export type SpotAttendee = SpotPerson & { joinedAt: Date };

export type SpotRequestStatus = 'pending' | 'rejected';

export type SpotRequest = SpotPerson & {
  requestedAt: Date;
  status: SpotRequestStatus;
};

export type SpotsState = {
  capacity: number;
  attendees: SpotAttendee[];
  requests: SpotRequest[];
};

/** Resultado visible de apuntarse o solicitar. */
export type JoinOutcome = 'joined' | 'requested' | 'alreadyAttending' | 'alreadyRequested';

export class SpotError extends Error {}

/** Valida el tope que elige el admin al convocar. */
export function validateCapacity(capacity: number | null | undefined): number {
  if (capacity == null) return DEFAULT_EVENT_CAPACITY;
  if (
    !Number.isInteger(capacity) ||
    capacity < MIN_EVENT_CAPACITY ||
    capacity > MAX_EVENT_CAPACITY
  ) {
    throw new SpotError(
      `El número de plazas debe estar entre ${MIN_EVENT_CAPACITY} y ${MAX_EVENT_CAPACITY}.`
    );
  }
  return capacity;
}

function isAttending(state: SpotsState, user: string): boolean {
  return state.attendees.some((a) => a.user === user);
}

function findRequest(state: SpotsState, user: string): SpotRequest | undefined {
  return state.requests.find((r) => r.user === user);
}

function pendingByAge(state: SpotsState): SpotRequest[] {
  return state.requests
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
}

export function hasFreeSpot(state: SpotsState): boolean {
  return state.attendees.length < state.capacity;
}

/**
 * Apuntarse. Con hueco entra; lleno, crea una solicitud. Así nadie se queda
 * fuera por pulsar justo cuando se ocupaba la última plaza: la UI le dice
 * que su solicitud queda en cola.
 */
export function join(state: SpotsState, person: SpotPerson, now: Date): JoinOutcome {
  if (isAttending(state, person.user)) return 'alreadyAttending';
  const existing = findRequest(state, person.user);
  if (existing?.status === 'rejected') {
    throw new SpotError('El admin no ha aprobado tu solicitud para esta convocatoria.');
  }
  if (existing) return 'alreadyRequested';

  if (hasFreeSpot(state)) {
    state.attendees.push({ ...person, joinedAt: now });
    return 'joined';
  }
  state.requests.push({ ...person, requestedAt: now, status: 'pending' });
  return 'requested';
}

/**
 * Pasa solicitudes pendientes a apuntados mientras haya hueco, la más antigua
 * primero. Devuelve a quién ha dejado entrar.
 */
export function promoteFromQueue(state: SpotsState, now: Date): SpotPerson[] {
  const promoted: SpotPerson[] = [];
  for (const req of pendingByAge(state)) {
    if (!hasFreeSpot(state)) break;
    state.requests = state.requests.filter((r) => r !== req);
    state.attendees.push({
      user: req.user,
      userKey: req.userKey,
      userName: req.userName,
      joinedAt: now,
    });
    promoted.push(req);
  }
  return promoted;
}

/**
 * Desapuntarse o retirar la solicitud. Si se libera una plaza, entra la
 * solicitud más antigua. Una solicitud rechazada no se puede retirar: el
 * rechazo se mantiene para esta convocatoria.
 */
export function leave(state: SpotsState, user: string, now: Date): void {
  const before = state.attendees.length;
  state.attendees = state.attendees.filter((a) => a.user !== user);
  state.requests = state.requests.filter(
    (r) => !(r.user === user && r.status === 'pending')
  );
  if (state.attendees.length < before) promoteFromQueue(state, now);
}

/** El admin aprueba (entra aunque se pase del tope) o rechaza una solicitud. */
export function review(
  state: SpotsState,
  user: string,
  approve: boolean,
  now: Date
): void {
  const req = findRequest(state, user);
  if (!req || req.status !== 'pending') {
    throw new SpotError('Esa solicitud ya no está pendiente.');
  }
  if (!approve) {
    req.status = 'rejected';
    return;
  }
  state.requests = state.requests.filter((r) => r !== req);
  state.attendees.push({
    user: req.user,
    userKey: req.userKey,
    userName: req.userName,
    joinedAt: now,
  });
}

/** Estado de la solicitud de alguien y su puesto en la cola (1 = la próxima). */
export function requestStatusFor(
  state: SpotsState,
  user: string
): { status: SpotRequestStatus; position: number | null } | null {
  const req = findRequest(state, user);
  if (!req) return null;
  if (req.status === 'rejected') return { status: 'rejected', position: null };
  const position = pendingByAge(state).findIndex((r) => r.user === user) + 1;
  return { status: 'pending', position };
}

export function pendingRequests(state: SpotsState): SpotRequest[] {
  return pendingByAge(state);
}
