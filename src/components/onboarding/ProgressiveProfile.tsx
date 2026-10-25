'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CADENCES, DELIVERY_SLOTS, DIET_TAGS, SUBSTITUTION_MODES, WEEKDAYS } from '@/lib/onboarding/model'
import {
  DEFAULT_CATEGORIES,
  MONTHLY_OPTIONS,
  ProgressiveId,
  SHOP_CATEGORIES,
  ShopCategory,
} from '@/lib/onboarding/basic'

interface StepRow {
  id: ProgressiveId
  label: string
  hint: string
  done: boolean
}

interface Profile {
  showReminder: boolean
  completeness: number
  pending: ProgressiveId[]
  steps: StepRow[]
  members: { id: string; name: string }[]
  hasPets: boolean
}

function clp(amount: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)
}

export default function ProgressiveProfile() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [open, setOpen] = useState<ProgressiveId | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [budget, setBudget] = useState<number>(MONTHLY_OPTIONS[0] ?? 300000)
  const [cadence, setCadence] = useState(CADENCES[0]?.id ?? '2w')
  const [mode, setMode] = useState(SUBSTITUTION_MODES[0]?.id ?? 'propose_approve')
  const [replacements, setReplacements] = useState('')
  const [alcohol, setAlcohol] = useState(true)
  const [tags, setTags] = useState<string[]>([])
  const [dietMembers, setDietMembers] = useState<string[]>([])
  const [brand, setBrand] = useState<'conveniente' | 'fija'>('conveniente')
  const [categories, setCategories] = useState<ShopCategory[]>(DEFAULT_CATEGORIES)
  const [day, setDay] = useState('sabado')
  const [slot, setSlot] = useState(DELIVERY_SLOTS[0] ?? { start: '09:00', end: '13:00', label: '09:00–13:00' })
  const [aseo, setAseo] = useState(true)
  const [food, setFood] = useState<'seco' | 'humedo' | 'mixto'>('seco')

  useEffect(() => {
    let active = true
    fetch('/api/onboarding/progressive')
      .then((response) => response.json())
      .then((body) => {
        if (!active) return
        if (!body?.success) {
          router.replace('/login')
          return
        }
        setProfile(body.data)
      })
      .catch(() => {
        if (active) router.replace('/login')
      })
    return () => { active = false }
  }, [router])

  const save = async (step: ProgressiveId, payload: unknown) => {
    setSaving(true)
    setError('')
    const response = await fetch('/api/onboarding/progressive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, payload }),
    })
    const body = await response.json()
    setSaving(false)
    if (!body?.success) {
      setError(body?.error?.message || 'No pude guardar')
      return
    }
    setProfile(body.data)
    setOpen(null)
  }

  if (!profile) {
    return <main className="min-h-screen bg-[#F8FAFC] px-4 py-10 text-sm text-slate-500">Cargando tu perfil…</main>
  }

  const done = profile.steps.filter((step) => step.done).length

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 pb-16 text-[#0F172A]">
      <div className="mx-auto max-w-md">
        <button type="button" onClick={() => router.push('/dashboard')} className="text-sm font-semibold text-[#4F46E5]">Volver</button>
        <h1 className="mt-3 text-2xl font-bold">Tu perfil</h1>
        <p className="mt-1 text-sm text-slate-600">{done} de {profile.steps.length} listos. Lo que falta afina el carro.</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${profile.completeness}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold text-[#0D9488]">{profile.completeness}% completo</p>
        <div className="mt-5 space-y-2">
          {profile.steps.map((step) => (
            <section key={step.id} className="rounded-2xl bg-white p-4">
              <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === step.id ? null : step.id)}>
                <span>
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className="text-xs text-slate-500">{step.hint}</span>
                </span>
                <span className={`text-xs font-bold ${step.done ? 'text-[#0D9488]' : 'text-[#F59E0B]'}`}>{step.done ? 'Listo' : 'Pendiente'}</span>
              </button>
              {open === step.id && (
                <div className="mt-3 space-y-2">
                  {step.id === 'presupuesto' && (
                    <div className="grid grid-cols-2 gap-2">
                      {MONTHLY_OPTIONS.map((amount, index) => (
                        <Pick key={amount} active={budget === amount} label={clp(amount)} recommended={index === 0} onClick={() => setBudget(amount)} />
                      ))}
                    </div>
                  )}
                  {step.id === 'cadencia' && CADENCES.map((item, index) => (
                    <Pick key={item.id} active={cadence === item.id} label={item.label} recommended={index === 0} onClick={() => setCadence(item.id)} />
                  ))}
                  {step.id === 'sustitucion' && (
                    <>
                      {SUBSTITUTION_MODES.map((item, index) => (
                        <Pick key={item.id} active={mode === item.id} label={item.label} hint={item.hint} recommended={index === 0} onClick={() => setMode(item.id)} />
                      ))}
                      {mode === 'specific' && (
                        <input className="avi-input" placeholder="Un reemplazo" value={replacements} onChange={(event) => setReplacements(event.target.value)} />
                      )}
                    </>
                  )}
                  {step.id === 'alcohol' && (
                    <>
                      <Pick active={alcohol} label="Sí, AVI puede proponer" recommended onClick={() => setAlcohol(true)} />
                      <Pick active={!alcohol} label="No" onClick={() => setAlcohol(false)} />
                    </>
                  )}
                  {step.id === 'dietas' && (
                    <>
                      <Pick active={tags.length === 0} label="Sin dieta especial" recommended onClick={() => setTags([])} />
                      <div className="flex flex-wrap gap-2">
                        {DIET_TAGS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setTags((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tags.includes(item.id) ? 'bg-[#4F46E5] text-white' : 'bg-slate-100'}`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {profile.members.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => setDietMembers((current) => current.includes(member.name) ? current.filter((name) => name !== member.name) : [...current, member.name])}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${dietMembers.includes(member.name) ? 'bg-[#0D9488] text-white' : 'bg-slate-100'}`}
                            >
                              {member.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {step.id === 'marcas' && (
                    <>
                      <Pick active={brand === 'conveniente'} label="La más conveniente" recommended onClick={() => setBrand('conveniente')} />
                      <Pick active={brand === 'fija'} label="Marcas fijas" onClick={() => setBrand('fija')} />
                    </>
                  )}
                  {step.id === 'categorias' && (
                    <div className="flex flex-wrap gap-2">
                      {SHOP_CATEGORIES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCategories((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${categories.includes(item.id) ? 'bg-[#4F46E5] text-white' : 'bg-slate-100'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {step.id === 'horarios' && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((item) => (
                          <button key={item.id} type="button" onClick={() => setDay(item.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${day === item.id ? 'bg-[#4F46E5] text-white' : 'bg-slate-100'}`}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {DELIVERY_SLOTS.map((item) => (
                          <Pick key={item.label} active={slot.start === item.start} label={item.label} recommended={item.start === '09:00'} onClick={() => setSlot(item)} />
                        ))}
                      </div>
                    </>
                  )}
                  {step.id === 'mascotas_aseo' && (
                    <>
                      <Pick active={aseo} label="Incluir aseo" recommended onClick={() => setAseo(true)} />
                      <Pick active={!aseo} label="Sin aseo por ahora" onClick={() => setAseo(false)} />
                      {profile.hasPets && (
                        <div className="grid grid-cols-3 gap-2">
                          {([['seco', 'Seco'], ['humedo', 'Húmedo'], ['mixto', 'Mixto']] as const).map(([id, label], index) => (
                            <Pick key={id} active={food === id} label={label} recommended={index === 0} onClick={() => setFood(id)} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    className="avi-btn-primary w-full"
                    onClick={() => save(step.id, payloadFor(step.id, {
                      budget, cadence, mode, replacements, alcohol, tags, dietMembers, brand, categories, day, slot, aseo, food, hasPets: profile.hasPets,
                    }))}
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        {profile.completeness === 100 && (
          <p className="mt-6 rounded-2xl bg-teal-50 px-4 py-3 text-sm text-[#0D9488]">Perfil listo. AVI ya puede afinar el carro.</p>
        )}
      </div>
    </main>
  )
}

function payloadFor(step: ProgressiveId, form: {
  budget: number
  cadence: string
  mode: string
  replacements: string
  alcohol: boolean
  tags: string[]
  dietMembers: string[]
  brand: 'conveniente' | 'fija'
  categories: ShopCategory[]
  day: string
  slot: { start: string; end: string }
  aseo: boolean
  food: 'seco' | 'humedo' | 'mixto'
  hasPets: boolean
}) {
  if (step === 'presupuesto') return { monthlyBudget: form.budget }
  if (step === 'cadencia') return { cadence: form.cadence }
  if (step === 'sustitucion') {
    return {
      mode: form.mode,
      replacements: form.mode === 'specific' ? form.replacements.split(',').map((item) => item.trim()).filter(Boolean) : [],
    }
  }
  if (step === 'alcohol') return { proposeAlcohol: form.alcohol }
  if (step === 'dietas') return { tags: form.tags, members: form.tags.length ? form.dietMembers : [] }
  if (step === 'marcas') return { preference: form.brand }
  if (step === 'categorias') return { categories: form.categories }
  if (step === 'horarios') return { day: form.day, start: form.slot.start, end: form.slot.end }
  return { includeAseo: form.aseo, petFood: form.hasPets ? form.food : null }
}

function Pick({
  active, label, hint, recommended, onClick,
}: {
  active: boolean
  label: string
  hint?: string
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`w-full rounded-2xl border px-3 py-2.5 text-left ${active ? 'border-[#4F46E5] bg-indigo-50' : 'border-slate-200 bg-white'}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {recommended && <span className="shrink-0 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[10px] font-bold text-white">Recomendado</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
    </button>
  )
}
