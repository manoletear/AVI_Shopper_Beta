import './globals.css'
import Providers from './providers'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'AVI Shopper - Compras Familiares Inteligentes',
  description: 'Orquestador inteligente de compras familiares con IA',
  icons: { icon: '/avi-icon.svg' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
