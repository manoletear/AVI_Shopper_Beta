'use client'

import { useState } from 'react'
import { ArrowLeft, Mail, Check, AlertCircle, Lock } from 'lucide-react'

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendCode = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_code', email }),
      })
      const data = await res.json()
      if (data.success) {
        setStep('code')
      } else {
        setError(data.error?.message || 'Error al enviar codigo')
      }
    } catch {
      setError('Error de conexion')
    }
    setLoading(false)
  }

  const resetPassword = async () => {
    if (!code.trim() || !newPassword.trim()) return
    if (newPassword.length < 8) { setError('Minimo 8 caracteres'); return }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email, code, newPassword }),
      })
      const data = await res.json()
      if (data.success) {
        setStep('done')
      } else {
        setError(data.error?.message || 'Codigo invalido')
      }
    } catch {
      setError('Error de conexion')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex flex-col justify-center px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center overflow-hidden border border-white/20">
            <img src="/avi-icon.svg" alt="AVI" className="w-12 h-12" />
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md py-8 px-6 rounded-2xl shadow-2xl sm:px-8">
          {step === 'email' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Recuperar contrasena</h2>
              <p className="text-sm text-gray-500 mb-6">Te enviaremos un codigo a tu email</p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="relative mb-4">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                  placeholder="tu@email.com" className="avi-input !pl-10" />
              </div>

              <button onClick={sendCode} disabled={loading || !email.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar codigo'}
              </button>
            </>
          )}

          {step === 'code' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Ingresa el codigo</h2>
              <p className="text-sm text-gray-500 mb-6">Revisa tu email {email}</p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="Codigo de 6 digitos" className="avi-input mb-3 text-center text-lg tracking-widest" />

              <div className="relative mb-4">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contrasena (min 8 caracteres)" className="avi-input !pl-10" />
              </div>

              <button onClick={resetPassword} disabled={loading || !code.trim() || !newPassword.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {loading ? 'Cambiando...' : 'Cambiar contrasena'}
              </button>

              <button onClick={() => { setStep('email'); setError('') }}
                className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700">
                Reenviar codigo
              </button>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-900 mb-1">Contrasena cambiada</h2>
              <p className="text-sm text-gray-500 mb-6">Ya puedes iniciar sesion con tu nueva contrasena</p>
              <a href="/login" className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-xl font-semibold">
                Ir a iniciar sesion
              </a>
            </div>
          )}

          {step !== 'done' && (
            <p className="mt-4 text-center text-sm text-gray-500">
              <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">Volver al login</a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
