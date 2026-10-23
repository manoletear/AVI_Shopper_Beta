import { JUMBO_CART_PAGE } from './types';

/**
 * Jumbo guarda un UUID en localStorage bajo la clave `sessionId`.
 * El sitio manda el header `x-provider-guest-id: guest:` + ese UUID sin los 2 primeros caracteres.
 */
export function createJumboGuestSession(sessionId = crypto.randomUUID()): {
  sessionId: string;
  guestHeader: string;
} {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new Error('sessionId de Jumbo inválido');
  }
  return {
    sessionId,
    guestHeader: `guest:${sessionId.slice(2)}`,
  };
}

export function jumboCartHandoffUrl(sessionId: string): string {
  const url = new URL(JUMBO_CART_PAGE);
  url.searchParams.set('avi_session', sessionId);
  return url.toString();
}

export const JUMBO_SESSION_STORAGE_KEY = 'sessionId';
export const JUMBO_SESSION_QUERY = 'avi_session';
