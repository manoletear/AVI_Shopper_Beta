import './globals.css'
import type { Viewport } from 'next'
import Providers from './providers'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'AVI Shopper',
  description: 'Tu asistente de compras familiar con IA',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/avi-icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/avi-icon.svg',
    shortcut: '/favicon.svg',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent' as const,
    title: 'AVI Shopper',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#4F46E5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans">
        <Providers>
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
