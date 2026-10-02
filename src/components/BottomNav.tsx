'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Home, ListChecks, ShoppingCart, Bot, User,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/listas', label: 'Listas', icon: ListChecks },
  { href: '/cart-assistant', label: 'Comprar', icon: ShoppingCart },
  { href: '/avi', label: 'AVI', icon: Bot },
  { href: '/perfil', label: 'Perfil', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  if (!session) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-gray-100 sm:hidden"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const isAvi = item.href === '/cart-assistant'

          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors ${
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {isAvi ? (
                <div className={`w-10 h-10 -mt-4 rounded-full flex items-center justify-center shadow-lg ${
                  isActive
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                }`}>
                  <img src="/avi-icon.svg" alt="AVI" className="w-6 h-6" />
                </div>
              ) : (
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              )}
              <span className={`text-[10px] font-medium ${isAvi ? 'mt-0.5' : ''}`}>{item.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
