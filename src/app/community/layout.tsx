import Link from 'next/link'
import { Home, FolderOpen } from 'lucide-react'

export const metadata = {
  title: 'Comunidad — AVI Shopper',
  description: 'Explora los proyectos activos de la comunidad AVI Shopper.',
}

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <nav className="flex items-center space-x-4 text-sm">
            <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors">
              <Home className="h-5 w-5" />
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/community/proyectos-activos/" className="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4" />
              Proyectos
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            <Home className="h-4 w-4" />
          </Link>
          <span>Proyectos</span>
        </div>
      </footer>
    </div>
  )
}
