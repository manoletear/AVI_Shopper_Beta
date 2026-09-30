import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

// Rutas que requieren autenticacion
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/avi/:path*',
    '/listas/:path*',
    '/salud/:path*',
    '/comparar/:path*',
    '/reposicion/:path*',
    '/perfil/:path*',
    '/presupuesto/:path*',
    '/presupuesto/:path*',
    '/configuracion/:path*',
  ],
};
