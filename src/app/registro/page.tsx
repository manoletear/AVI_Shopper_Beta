'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, User, ArrowRight, AlertCircle, Check } from 'lucide-react'
import { pathAfterAuth } from '@/lib/onboarding/after-auth'

function RegistroForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error?.message || 'Error'); setLoading(false); return }

      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) { setError(result.error); setLoading(false); return }

      if (inviteCode) {
        await fetch('/api/family', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'join', inviteCode }),
        }).catch(() => {})
      }

      if (inviteCode) router.push('/familia')
      else router.push(await pathAfterAuth())
    } catch { setError('Error de conexion'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 flex flex-col justify-center px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center overflow-hidden border border-white/20">
            <img src="/avi-icon.svg" alt="AVI" className="w-12 h-12" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-white">Crea tu cuenta gratis</h2>
        <p className="mt-1 text-center text-sm text-blue-200">
          Empieza a ahorrar en tus compras
        </p>

        <div className="mt-6 bg-white/95 backdrop-blur-md py-8 px-6 rounded-2xl shadow-2xl sm:px-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre</label>
              <div className="mt-1 relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre" className="avi-input !pl-10" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com" className="avi-input !pl-10" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contrasena</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input id="password" type="password" required minLength={8} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres" className="avi-input !pl-10" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 transition-all">
              {loading ? (
                <span className="flex gap-1"><span className="w-2 h-2 bg-white rounded-full animate-bounce"></span><span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span></span>
              ) : (
                <>Crear Cuenta<ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </button>
          </form>

          <div className="mt-5 space-y-2">
            {['Compara precios en 4 supermercados', 'Alertas de nutricion y alergenos', 'Prediccion de reposicion con IA'].map((b) => (
              <div key={b} className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-emerald-600" />
                </div>
                <span className="text-xs text-gray-500">{b}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta? <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Inicia sesion</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroForm />
    </Suspense>
  )
}
