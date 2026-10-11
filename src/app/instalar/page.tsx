'use client'

import { useState } from 'react'
import { ArrowLeft, BookmarkPlus, ShoppingCart, Check, Smartphone, Monitor, Copy } from 'lucide-react'

const BOOKMARKLET_CODE = `javascript:void(fetch('https://avi-shopper-beta.vercel.app/avi-bookmarklet.js').then(r=>r.text()).then(c=>eval(c)))`;

export default function InstalarPage() {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(BOOKMARKLET_CODE).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></a>
          <img src="/avi-icon.svg" alt="" className="w-8 h-8 rounded-lg" />
          <h1 className="text-lg font-bold text-gray-900">Instalar AVI en tu navegador</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookmarkPlus className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">AVI compra por ti</h2>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Agrega el boton de AVI a tu navegador. Cuando abras un supermercado, AVI agrega los productos al carrito automaticamente.
          </p>
        </div>

        {/* iPhone / Safari */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Smartphone className="h-6 w-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">iPhone / Safari</h3>
          </div>
          <ol className="space-y-4 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">1</span>
              <div>
                <p className="font-medium text-gray-900">Copia el codigo de AVI</p>
                <button onClick={copyCode} className="mt-2 flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-xs font-medium">
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copiado!</> : <><Copy className="h-3.5 w-3.5" /> Copiar codigo de AVI</>}
                </button>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">2</span>
              <div>
                <p className="font-medium text-gray-900">Agrega un favorito cualquiera en Safari</p>
                <p className="text-gray-400 mt-0.5">Toca el icono de compartir → "Agregar a favoritos"</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">3</span>
              <div>
                <p className="font-medium text-gray-900">Edita el favorito</p>
                <p className="text-gray-400 mt-0.5">Cambia el nombre a <strong>"AVI Comprar"</strong> y reemplaza la URL por el codigo copiado</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">4</span>
              <div>
                <p className="font-medium text-gray-900">Listo! Para comprar:</p>
                <p className="text-gray-400 mt-0.5">Abre Lider/Jumbo/Unimarc en Safari → toca el favorito "AVI Comprar" → AVI agrega todo al carrito</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Desktop / Chrome */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="h-6 w-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">Computador / Chrome</h3>
          </div>
          <ol className="space-y-4 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">1</span>
              <div>
                <p className="font-medium text-gray-900">Arrastra este boton a tu barra de favoritos:</p>
                <a
                  href={BOOKMARKLET_CODE}
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center gap-2 mt-2 bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold cursor-grab active:cursor-grabbing shadow-lg"
                >
                  <ShoppingCart className="h-4 w-4" />
                  AVI Comprar
                </a>
                <p className="text-gray-400 mt-1.5 text-xs">Arrastralo con el mouse a la barra de marcadores</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">2</span>
              <div>
                <p className="font-medium text-gray-900">Para comprar:</p>
                <p className="text-gray-400 mt-0.5">Abre Lider, Jumbo, Unimarc o Tottus → click en "AVI Comprar" en tu barra de favoritos</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Extension Chrome */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-indigo-100">
          <div className="flex items-center gap-3 mb-2">
            <Monitor className="h-6 w-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">Extension Chrome (automatico)</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Para compra 100% automatica en desktop, instala la extension de Chrome. AVI agrega productos sin que toques nada.
          </p>
          <a href="https://github.com/manoletear/AVI_Shopper_Beta/tree/main/chrome-extension" target="_blank"
            className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
            Instrucciones de instalacion →
          </a>
        </div>
      </main>
    </div>
  )
}
