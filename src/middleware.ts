import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/avi/:path*',
    '/listas/:path*',
    '/salud/:path*',
    '/comparar/:path*',
    '/reposicion/:path*',
    '/perfil/:path*',
    '/familia/:path*',
    '/presupuesto/:path*',
    '/configuracion/:path*',
  ],
};
