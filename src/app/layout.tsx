import './globals.css'

export const metadata = {
  title: 'AVI Shopper - Compras Familiares Inteligentes',
  description: 'Orquestador inteligente de compras familiares con IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
