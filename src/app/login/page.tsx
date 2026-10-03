'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) { setError(result.error); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex flex-col justify-center px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center overflow-hidden border border-white/20">
            <img src="/avi-icon.svg" alt="AVI" className="w-12 h-12" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-white">Bienvenido a AVI</h2>
        <p className="mt-1 text-center text-sm text-blue-200">
          Inicia sesion para gestionar tus compras
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
                <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="avi-input !pl-10" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 transition-all">
              {loading ? (
                <span className="flex gap-1"><span className="w-2 h-2 bg-white rounded-full animate-bounce"></span><span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span></span>
              ) : (
                <>Iniciar Sesion<ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </button>
          </form>

          <div className="mt-3 text-center">
            <a href="/recuperar" className="text-sm text-gray-400 hover:text-blue-500">¿Olvidaste tu contrasena?</a>
          </div>

          <p className="mt-3 text-center text-sm text-gray-500">
            ¿No tienes cuenta? <a href="/registro" className="font-medium text-blue-600 hover:text-blue-500">Registrate gratis</a>
          </p>

          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-center text-gray-400">Demo: demo@avishopper.cl / demo123456</p>
          </div>
        </div>
      </div>
    </div>
  )
}
