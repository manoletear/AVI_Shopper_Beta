'use client'

import { useState, useEffect } from 'react'

const ADS = [
  { store: 'Jumbo', bg: 'bg-[#006B3F]', text: 'Ofertas frescas en Jumbo', sub: 'Frutas y verduras desde $990/kg', emoji: '🥬', href: '/comparar?q=Frutas%2C+Verduras' },
  { store: 'Lider', bg: 'bg-[#0032A0]', text: 'Precios bajos todos los dias', sub: 'Compara y ahorra con AVI', emoji: '🛒', href: '/comparar?q=Pollo%2C+Carne%2C+Arroz' },
  { store: 'Unimarc', bg: 'bg-[#E8590C]', text: 'Descuentos con tarjeta', sub: '30% en lacteos seleccionados', emoji: '🧀', href: '/comparar?q=Leche%2C+Yogurt%2C+Queso' },
  { store: 'Tottus', bg: 'bg-[#00695C]', text: '3x2 en limpieza', sub: 'Detergente, cloro y mas', emoji: '🧴', href: '/comparar?q=Detergente%2C+Cloro%2C+Lavalozas' },
]

export default function AdBanner({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(Math.floor(Math.random() * ADS.length))
  }, [])

  const ad = ADS[idx]
  if (!ad) return null

  if (variant === 'compact') {
    return (
      <a href={ad.href} className={`flex items-center gap-3 ${ad.bg} rounded-xl px-4 py-3 text-white active:scale-[0.98] transition-transform`}>
        <span className="text-xl">{ad.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">{ad.store}</p>
          <p className="text-[11px] text-white/80 truncate">{ad.sub}</p>
        </div>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">Ver</span>
      </a>
    )
  }

  return (
    <a href={ad.href} className={`block ${ad.bg} rounded-2xl p-4 text-white active:scale-[0.98] transition-transform`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">{ad.store}</span>
          <p className="text-sm font-bold mt-1.5">{ad.text}</p>
          <p className="text-xs text-white/70">{ad.sub}</p>
        </div>
        <span className="text-3xl">{ad.emoji}</span>
      </div>
    </a>
  )
}
