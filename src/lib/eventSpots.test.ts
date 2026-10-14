import { describe, it, expect } from 'vitest';
import {
  join,
  leave,
  pendingRequests,
  requestStatusFor,
  review,
  validateCapacity,
  type SpotsState,
} from './eventSpots';

const t0 = new Date('2026-10-14T10:00:00Z');
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
const person = (name: string) => ({
  user: `id-${name}`,
  userKey: name,
  userName: name,
});

function stateWith(capacity: number, attendees: string[] = []): SpotsState {
  return {
    capacity,
    attendees: attendees.map((n, i) => ({ ...person(n), joinedAt: at(i) })),
    requests: [],
  };
}

describe('join', () => {
  it('con hueco entra directamente', () => {
    const s = stateWith(2, ['ana']);
    expect(join(s, person('luis'), at(10))).toBe('joined');
    expect(s.attendees).toHaveLength(2);
  });

  it('lleno, crea una solicitud pendiente', () => {
    const s = stateWith(2, ['ana', 'luis']);
    expect(join(s, person('pepe'), at(10))).toBe('requested');
    expect(s.attendees).toHaveLength(2);
    expect(requestStatusFor(s, 'id-pepe')).toEqual({ status: 'pending', position: 1 });
  });

  it('es idempotente', () => {
    const s = stateWith(1, ['ana']);
    expect(join(s, person('ana'), at(10))).toBe('alreadyAttending');
    join(s, person('pepe'), at(11));
    expect(join(s, person('pepe'), at(12))).toBe('alreadyRequested');
    expect(s.requests).toHaveLength(1);
  });

  it('la cola respeta el orden de llegada', () => {
    const s = stateWith(1, ['ana']);
    join(s, person('pepe'), at(10));
    join(s, person('marta'), at(11));
    expect(requestStatusFor(s, 'id-marta')?.position).toBe(2);
  });
});

describe('leave', () => {
  it('al liberarse una plaza entra la solicitud más antigua', () => {
    const s = stateWith(2, ['ana', 'luis']);
    join(s, person('pepe'), at(10));
    join(s, person('marta'), at(11));
    leave(s, 'id-luis', at(20));
    expect(s.attendees.map((a) => a.userName)).toEqual(['ana', 'pepe']);
    expect(requestStatusFor(s, 'id-pepe')).toBeNull();
    expect(requestStatusFor(s, 'id-marta')).toEqual({ status: 'pending', position: 1 });
  });

  it('retirar la solicitud no deja entrar a nadie', () => {
    const s = stateWith(1, ['ana']);
    join(s, person('pepe'), at(10));
    join(s, person('marta'), at(11));
    leave(s, 'id-pepe', at(20));
    expect(s.attendees.map((a) => a.userName)).toEqual(['ana']);
    expect(pendingRequests(s).map((r) => r.userName)).toEqual(['marta']);
  });

  it('las rechazadas no entran al liberarse plaza', () => {
    const s = stateWith(1, ['ana']);
    join(s, person('pepe'), at(10));
    review(s, 'id-pepe', false, at(11));
    leave(s, 'id-ana', at(20));
    expect(s.attendees).toHaveLength(0);
    expect(requestStatusFor(s, 'id-pepe')?.status).toBe('rejected');
  });
});

describe('review', () => {
  it('aprobar entra aunque se pase del tope', () => {
    const s = stateWith(2, ['ana', 'luis']);
    join(s, person('pepe'), at(10));
    review(s, 'id-pepe', true, at(11));
    expect(s.attendees.map((a) => a.userName)).toEqual(['ana', 'luis', 'pepe']);
    expect(s.requests).toHaveLength(0);
  });

  it('rechazar impide volver a pedir o apuntarse', () => {
    const s = stateWith(1, ['ana']);
    join(s, person('pepe'), at(10));
    review(s, 'id-pepe', false, at(11));
    expect(() => join(s, person('pepe'), at(12))).toThrow(/no ha aprobado/);
    // Ni aunque haya hueco.
    leave(s, 'id-ana', at(13));
    expect(() => join(s, person('pepe'), at(14))).toThrow(/no ha aprobado/);
  });

  it('no se puede revisar dos veces', () => {
    const s = stateWith(1, ['ana']);
    join(s, person('pepe'), at(10));
    review(s, 'id-pepe', true, at(11));
    expect(() => review(s, 'id-pepe', false, at(12))).toThrow(/pendiente/);
  });
});

describe('validateCapacity', () => {
  it('12 por defecto y entre 1 y 100', () => {
    expect(validateCapacity(undefined)).toBe(12);
    expect(validateCapacity(20)).toBe(20);
    expect(() => validateCapacity(0)).toThrow();
    expect(() => validateCapacity(2.5)).toThrow();
    expect(() => validateCapacity(101)).toThrow();
  });
});
