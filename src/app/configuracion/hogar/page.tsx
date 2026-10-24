'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STEPS, OnboardingView, clp } from '@/lib/onboarding/model'

export default function HogarSettingsPage() {
  const router = useRouter()
  const [view, setView] = useState<OnboardingView | null>(null)
  const [elderWeight, setElderWeight] = useState('0.8')
  const [approverRole, setApproverRole] = useState('master')
  const [proposeAlcohol, setProposeAlcohol] = useState(true)
  const [message, setMessage] = useState('')

  const load = () => {
    fetch('/api/onboarding').then((response) => response.json()).then((body) => {
      if (!body?.success) return
      const state = body.data as OnboardingView
      setView(state)
      setElderWeight(String(state.elderWeight))
      setApproverRole(state.approverRole)
      setProposeAlcohol(state.proposeAlcohol)
    })
  }

  useEffect(() => { load() }, [])

  const saveDefaults = async () => {
    setMessage('')
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'defaults', payload: { elderWeight, approverRole, proposeAlcohol } }),
    })
    const body = await response.json()
    if (!body?.success) {
      setMessage(body?.error?.message || 'No pude guardar')
      return
    }
    setView(body.data)
    setMessage('Guardado')
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 pb-24 text-[#0F172A]">
      <div className="mx-auto max-w-md">
        <button type="button" onClick={() => router.push('/dashboard')} className="text-sm font-semibold text-[#4F46E5]">Volver</button>
        <h1 className="mt-3 text-2xl font-bold">Tu hogar</h1>
        <p className="mt-1 text-sm text-slate-600">Lo que saltaste en el onboarding se completa acá.</p>
        <div className="mt-5 space-y-2">
          {STEPS.map((step) => {
            const status = view?.steps[step.id] || 'pending'
            const label = status === 'done' ? 'Listo' : status === 'skipped' ? 'Saltado' : 'Pendiente'
            return (
              <a key={step.id} href={`/onboarding?paso=${step.id}&desde=ajustes`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">{step.settingsLabel}</span>
                  <span className="text-xs text-slate-500">{step.required ? 'Necesario para cotizar' : 'Opcional'}</span>
                </span>
                <span className={`text-xs font-bold ${status === 'done' ? 'text-[#0D9488]' : status === 'skipped' ? 'text-[#F59E0B]' : 'text-slate-400'}`}>{label}</span>
              </a>
            )
          })}
        </div>
        <section className="mt-6 rounded-2xl bg-white p-4">
          <h2 className="text-sm font-bold">Decisiones del hogar</h2>
          <label className="mt-3 block text-sm">
            Quién aprueba el carro
            <select className="avi-input mt-1" value={approverRole} onChange={(event) => setApproverRole(event.target.value)}>
              <option value="master">El administrador</option>
              <option value="adult">Cualquier adulto</option>
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Ponderación adulto mayor
            <input className="avi-input mt-1" value={elderWeight} onChange={(event) => setElderWeight(event.target.value)} />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={proposeAlcohol} onChange={(event) => setProposeAlcohol(event.target.checked)} />
            Proponer alcohol
          </label>
          {view?.budget ? <p className="mt-3 text-xs text-slate-500">Porción: {clp(view.budget)}</p> : null}
          {view?.monthlyBudget ? <p className="text-xs text-slate-500">Mensual: {clp(view.monthlyBudget)}</p> : null}
          {view?.orderCap ? <p className="text-xs text-slate-500">Tope por pedido: {clp(view.orderCap)}</p> : null}
          <button type="button" onClick={saveDefaults} className="avi-btn-primary mt-4 w-full">Guardar decisiones</button>
          {message && <p className="mt-2 text-xs text-slate-500">{message}</p>}
        </section>
      </div>
    </main>
  )
}
