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
    '/listas/:path*',
    '/salud/:path*',
    '/comparar/:path*',
    '/perfil/:path*',
    '/presupuesto/:path*',
    '/presupuesto/:path*',
    '/configuracion/:path*',
  ],
};
