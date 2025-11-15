import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { UnauthorizedError } from './errors';

export async function getSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new UnauthorizedError('No autorizado');
  }

  return session;
}

export async function requireAuth() {
  const session = await getSession();
  return session.user.id;
}
