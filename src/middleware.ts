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
    '/presupuesto/:path*',
    '/configuracion/:path*',
  ],
};
