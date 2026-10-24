'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ALLERGENS,
  CADENCES,
  CHAINS,
  DEFAULT_DELIVERY_WINDOW,
  DELIVERY_SLOTS,
  DIET_TAGS,
  DROPOFFS,
  HOUSEHOLD_SIZES,
  MEMBER_COLORS,
  OnboardingView,
  PORTION_BUDGETS,
  STEPS,
  SUBSTITUTION_MODES,
  StepId,
  WEEKDAYS,
  clp,
} from '@/lib/onboarding/model'

type Draft = {
  street: string
  number: string
  unit: string
  comuna: string
  dropoff: string
  notes: string
  windows: { day: string; start: string; end: string }[]
  mode: string
  stores: Record<string, { enabled: boolean; loyaltyProgram: string }>
  householdSize: number
  includesBaby: boolean
  includesToddler: boolean
  includesPet: boolean
  members: { id?: string; name: string; email: string; color: string }[]
  allergens: string[]
  dislikes: string[]
  dislikeDraft: string
  dietTags: string[]
  primaryDiet: string
  pets: { id?: string; name: string; species: string; stage: string; food: string }[]
  substitutionMode: string
  replacements: string[]
  cadence: string
  deliveryDay: string
  budget: number | null
  monthlyBudget: string
  orderCap: string
  proposeAlcohol: boolean
}

function draftFrom(view: OnboardingView): Draft {
  const stores: Draft['stores'] = {}
  for (const chain of CHAINS) {
    const found = view.stores.find((store) => store.chain === chain.id)
    stores[chain.id] = { enabled: Boolean(found?.enabled), loyaltyProgram: found?.loyaltyProgram || '' }
  }
  return {
    street: view.address?.street || '',
    number: view.address?.number || '',
    unit: view.address?.unit || '',
    comuna: view.address?.comuna || '',
    dropoff: view.address?.dropoff || 'door',
    notes: view.address?.notes || '',
    windows: view.windows.length ? view.windows : [{ ...DEFAULT_DELIVERY_WINDOW }],
    mode: view.mode || 'delivery',
    stores,
    householdSize: view.householdSize || 2,
    includesBaby: view.includesBaby,
    includesToddler: view.includesToddler,
    includesPet: view.includesPet,
    members: view.members.length ? view.members : [{ name: 'Yo', email: '', color: MEMBER_COLORS[0] }],
    allergens: view.allergens,
    dislikes: view.dislikes,
    dislikeDraft: '',
    dietTags: view.dietTags,
    primaryDiet: view.primaryDiet || '',
    pets: view.pets,
    substitutionMode: view.substitutionMode || 'best_match',
    replacements: [...view.replacements, '', '', ''].slice(0, 3),
    cadence: view.cadence || '',
    deliveryDay: view.deliveryDay || '',
    budget: view.budget,
    monthlyBudget: view.monthlyBudget ? String(view.monthlyBudget) : '',
    orderCap: view.orderCap ? String(view.orderCap) : '',
    proposeAlcohol: view.proposeAlcohol,
  }
}

function payloadFor(step: StepId, draft: Draft) {
  if (step === 'address') {
    return {
      street: draft.street,
      number: draft.number,
      unit: draft.unit,
      comuna: draft.comuna,
      dropoff: draft.dropoff,
      notes: draft.notes,
      windows: draft.windows,
    }
  }
  if (step === 'stores') {
    return {
      mode: draft.mode,
      stores: CHAINS.map((chain) => ({
        chain: chain.id,
        enabled: draft.stores[chain.id]?.enabled || false,
        loyaltyProgram: draft.stores[chain.id]?.enabled ? draft.stores[chain.id].loyaltyProgram || null : null,
      })),
    }
  }
  if (step === 'household') {
    return {
      householdSize: draft.householdSize,
      includesBaby: draft.includesBaby,
      includesToddler: draft.includesToddler,
      includesPet: draft.includesPet,
    }
  }
  if (step === 'members') return { members: draft.members }
  if (step === 'allergies') return { allergens: draft.allergens, dislikes: draft.dislikes }
  if (step === 'diets') return { tags: draft.dietTags, primary: draft.primaryDiet || null }
  if (step === 'pets') return { pets: draft.pets }
  if (step === 'substitutions') {
    return { mode: draft.substitutionMode, replacements: draft.replacements.map((item) => item.trim()).filter(Boolean) }
  }
  if (step === 'cadence') return { cadence: draft.cadence, deliveryDay: draft.deliveryDay }
  return {
    budget: draft.budget,
    monthlyBudget: draft.monthlyBudget,
    orderCap: draft.orderCap,
    proposeAlcohol: draft.proposeAlcohol,
  }
}

export default function OnboardingFlow() {
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get('paso') as StepId | null
  const editing = params.get('desde') === 'ajustes'
  const [view, setView] = useState<OnboardingView | null>(null)
  const [step, setStep] = useState<StepId>('address')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    const paso = requested
    fetch('/api/onboarding')
      .then((response) => response.json())
      .then((body) => {
        if (!body?.success) {
          router.replace('/login')
          return
        }
        const state = body.data as OnboardingView
        if (!state.needsOnboarding && !paso) {
          router.replace('/dashboard')
          return
        }
        const initial = paso && STEPS.some((item) => item.id === paso) ? paso : (state.step === 'done' ? 'address' : state.step)
        setView(state)
        setStep(initial)
        setDraft(draftFrom(state))
      })
      .catch(() => router.replace('/login'))
  }, [requested, router])

  useEffect(() => {
    if (view?.inviteCode) setInviteUrl(`${window.location.origin}/registro?invite=${view.inviteCode}`)
  }, [view?.inviteCode])

  const meta = STEPS.find((item) => item.id === step) || STEPS[0]
  const index = STEPS.findIndex((item) => item.id === step)

  const submit = async (action: 'save' | 'skip') => {
    if (!draft) return
    setSaving(true)
    setError('')
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, action, payload: action === 'save' ? payloadFor(step, draft) : {} }),
    })
    const body = await response.json()
    setSaving(false)
    if (!body?.success) {
      setError(body?.error?.message || 'No pude guardar')
      return
    }
    const state = body.data as OnboardingView
    setView(state)
    setDraft(draftFrom(state))
    if (editing) {
      router.push('/configuracion/hogar')
      return
    }
    if (state.finished || state.step === 'done') {
      setDone(true)
      return
    }
    setStep(state.step)
  }

  const patch = (partial: Partial<Draft>) => setDraft((current) => current ? { ...current, ...partial } : current)

  if (done) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] px-4 py-10 text-[#0F172A]" data-screen="listo">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#0D9488]">Hogar listo</p>
          <h1 className="mt-2 text-2xl font-bold">AVI propone. La familia aprueba.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Con la dirección y las tiendas ya podemos cotizar. Lo que saltaste queda en Ajustes para completarlo cuando quieras.
          </p>
          <button type="button" onClick={() => router.push('/dashboard')} className="avi-btn-primary mt-6 w-full">
            Ir al inicio
          </button>
        </div>
      </main>
    )
  }

  if (!draft || !view) {
    return <main className="min-h-screen bg-[#F8FAFC] px-4 py-10 text-sm text-slate-500">Cargando tu hogar…</main>
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-md flex-col bg-[#F8FAFC] text-[#0F172A]" data-screen={step}>
      <div data-testid="onboarding-scroll" className="flex-1 overflow-y-auto px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Paso {index + 1} de {STEPS.length}</span>
          {!meta.required && <span className="text-[#0D9488]">Puedes saltarlo</span>}
        </div>
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="onboarding-title">{meta.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{meta.subtitle}</p>
        <div className="mt-5 flex-1 space-y-4">
          {step === 'address' && <AddressScreen draft={draft} patch={patch} />}
          {step === 'stores' && <StoresScreen draft={draft} patch={patch} />}
          {step === 'household' && <HouseholdScreen draft={draft} patch={patch} />}
          {step === 'members' && <MembersScreen draft={draft} patch={patch} inviteUrl={inviteUrl} />}
          {step === 'allergies' && <AllergiesScreen draft={draft} patch={patch} />}
          {step === 'diets' && <DietsScreen draft={draft} patch={patch} />}
          {step === 'pets' && <PetsScreen draft={draft} patch={patch} />}
          {step === 'substitutions' && <SubstitutionsScreen draft={draft} patch={patch} />}
          {step === 'cadence' && <CadenceScreen draft={draft} patch={patch} />}
          {step === 'budget' && <BudgetScreen draft={draft} patch={patch} />}
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      </div>
      <footer className="border-t border-slate-200 bg-white">
        <div className="flex gap-2 px-4 py-3">
          {!meta.required && (
            <button type="button" data-testid="onboarding-skip" disabled={saving} onClick={() => submit('skip')} className="avi-btn-secondary flex-1">
              Saltar
            </button>
          )}
          <button type="button" data-testid="onboarding-continue" disabled={saving} onClick={() => submit('save')} className="avi-btn-primary flex-1">
            {saving ? 'Guardando…' : editing ? 'Guardar' : index === STEPS.length - 1 ? 'Terminar' : 'Continuar'}
          </button>
        </div>
      </footer>
    </main>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function Choice({
  active, label, hint, onClick,
}: { active: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-[#4F46E5] bg-indigo-50' : 'border-slate-200 bg-white'}`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
    </button>
  )
}

function AddressScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  const slot = draft.windows[0] || DEFAULT_DELIVERY_WINDOW
  return (
    <>
      <Field label="Calle">
        <input className="avi-input" value={draft.street} onChange={(event) => patch({ street: event.target.value })} placeholder="Los Leones" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Número">
          <input className="avi-input" value={draft.number} onChange={(event) => patch({ number: event.target.value })} placeholder="123" />
        </Field>
        <Field label="Depto o casa">
          <input className="avi-input" value={draft.unit} onChange={(event) => patch({ unit: event.target.value })} placeholder="Depto 402" />
        </Field>
      </div>
      <Field label="Comuna">
        <input className="avi-input" value={draft.comuna} onChange={(event) => patch({ comuna: event.target.value })} placeholder="Providencia" />
      </Field>
      <div>
        <p className="mb-2 text-sm font-medium">Ventana recurrente</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button key={day.id} type="button" onClick={() => patch({ windows: [{ ...slot, day: day.id }] })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${slot.day === day.id ? 'bg-[#4F46E5] text-white' : 'bg-white text-slate-600'}`}>
              {day.label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DELIVERY_SLOTS.map((item) => {
            const active = slot.day && slot.start === item.start && slot.end === item.end
            return (
              <button key={item.label} type="button" onClick={() => patch({ windows: [{ ...slot, start: item.start, end: item.end }] })} className={`rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-[#0D9488] text-white' : 'bg-white text-slate-700'}`}>
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-2">
        {DROPOFFS.map((item) => (
          <Choice key={item.id} active={draft.dropoff === item.id} label={item.label} hint={item.hint} onClick={() => patch({ dropoff: item.id })} />
        ))}
      </div>
      <Field label="Instrucciones">
        <input className="avi-input" value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} placeholder="Conserjería o código del portón" />
      </Field>
    </>
  )
}

function StoresScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {[
          ['delivery', 'Despacho a domicilio'],
          ['pickup', 'Retiro en tienda'],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => patch({ mode: id })} className={`rounded-2xl px-3 py-3 text-sm font-semibold ${draft.mode === id ? 'bg-[#4F46E5] text-white' : 'bg-white text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {CHAINS.map((chain) => {
        const selected = draft.stores[chain.id]
        return (
          <div key={chain.id} className={`rounded-2xl border p-4 ${selected?.enabled ? 'border-[#4F46E5] bg-white' : 'border-slate-200 bg-white'}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between"
              onClick={() => patch({ stores: { ...draft.stores, [chain.id]: { ...selected, enabled: !selected?.enabled } } })}
            >
              <span className="font-semibold">{chain.label}</span>
              <span className={`text-xs font-bold ${selected?.enabled ? 'text-[#4F46E5]' : 'text-slate-400'}`}>{selected?.enabled ? 'Elegida' : 'Elegir'}</span>
            </button>
            {selected?.enabled && (
              <div className="mt-3 space-y-2">
                <button type="button" onClick={() => patch({ stores: { ...draft.stores, [chain.id]: { ...selected, loyaltyProgram: '' } } })} className="text-xs text-slate-500">Sin programa</button>
                {chain.loyalty.map((program) => (
                  <Choice
                    key={program.id}
                    active={selected.loyaltyProgram === program.id}
                    label={program.label}
                    onClick={() => patch({ stores: { ...draft.stores, [chain.id]: { ...selected, loyaltyProgram: program.id } } })}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function HouseholdScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {HOUSEHOLD_SIZES.map((size) => (
          <button key={size} type="button" onClick={() => patch({ householdSize: size })} className={`rounded-2xl py-5 text-2xl font-bold ${draft.householdSize === size ? 'bg-[#4F46E5] text-white' : 'bg-white text-slate-800'}`}>
            {size}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Por defecto son 2 personas.</p>
      {[
        ['includesBaby', 'También compro para un bebé'],
        ['includesToddler', 'También compro para un niño pequeño'],
        ['includesPet', 'También compro para una mascota'],
      ].map(([key, label]) => (
        <Choice key={key} active={Boolean(draft[key as 'includesBaby'])} label={label} onClick={() => patch({ [key]: !draft[key as 'includesBaby'] } as Partial<Draft>)} />
      ))}
    </>
  )
}

function MembersScreen({
  draft, patch, inviteUrl,
}: { draft: Draft; patch: (partial: Partial<Draft>) => void; inviteUrl: string }) {
  const update = (index: number, partial: Partial<Draft['members'][number]>) => {
    const members = draft.members.map((member, i) => i === index ? { ...member, ...partial } : member)
    patch({ members })
  }
  return (
    <>
      {draft.members.map((member, index) => (
        <div key={member.id || index} className="rounded-2xl bg-white p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">{index === 0 ? 'Tú' : `Integrante ${index + 1}`}</p>
          <input className="avi-input mb-2" value={member.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Nombre" />
          {index > 0 && (
            <input className="avi-input mb-2" value={member.email} onChange={(event) => update(index, { email: event.target.value })} placeholder="Email" />
          )}
          <div className="flex gap-2">
            {MEMBER_COLORS.map((color) => (
              <button key={color} type="button" aria-label={color} onClick={() => update(index, { color })} className="h-7 w-7 rounded-full" style={{ background: color, outline: member.color === color ? '2px solid #0F172A' : 'none', outlineOffset: 2 }} />
            ))}
          </div>
        </div>
      ))}
      {draft.members.length < 4 && (
        <button
          type="button"
          className="w-full rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-[#4F46E5]"
          onClick={() => patch({ members: [...draft.members, { name: '', email: '', color: MEMBER_COLORS[draft.members.length % MEMBER_COLORS.length] }] })}
        >
          Agregar integrante
        </button>
      )}
      {inviteUrl && (
        <div className="rounded-2xl bg-indigo-50 p-4">
          <p className="text-sm font-semibold">Invitar a la familia</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">El link abre un carro familiar compartido. Pueden sumar hasta 3 integrantes.</p>
          <p className="mt-2 break-all text-xs text-[#4F46E5]">{inviteUrl}</p>
        </div>
      )}
    </>
  )
}

function AllergiesScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  const toggle = (id: string) => {
    const allergens = draft.allergens.includes(id) ? draft.allergens.filter((item) => item !== id) : [...draft.allergens, id]
    patch({ allergens })
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {ALLERGENS.map((item) => (
          <button key={item.id} type="button" onClick={() => toggle(item.id)} className={`rounded-2xl px-3 py-3 text-left text-sm font-semibold ${draft.allergens.includes(item.id) ? 'bg-[#E11D48] text-white' : 'bg-white text-slate-800'}`}>
            {item.label}
          </button>
        ))}
      </div>
      <Field label="Ingredientes que no les gustan">
        <div className="flex gap-2">
          <input className="avi-input" value={draft.dislikeDraft} onChange={(event) => patch({ dislikeDraft: event.target.value })} placeholder="Cilantro, aceitunas…" />
          <button
            type="button"
            className="rounded-xl bg-[#0D9488] px-3 text-sm font-semibold text-white"
            onClick={() => {
              const name = draft.dislikeDraft.trim()
              if (!name || draft.dislikes.includes(name)) return
              patch({ dislikes: [...draft.dislikes, name], dislikeDraft: '' })
            }}
          >
            Sumar
          </button>
        </div>
      </Field>
      <div className="flex flex-wrap gap-2">
        {draft.dislikes.map((item) => (
          <button key={item} type="button" onClick={() => patch({ dislikes: draft.dislikes.filter((name) => name !== item) })} className="rounded-full bg-white px-3 py-1 text-xs font-medium">
            {item} ×
          </button>
        ))}
      </div>
    </>
  )
}

function DietsScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  const toggle = (id: string) => {
    const dietTags = draft.dietTags.includes(id) ? draft.dietTags.filter((item) => item !== id) : [...draft.dietTags, id]
    patch({ dietTags })
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {DIET_TAGS.map((item) => (
          <button key={item.id} type="button" onClick={() => toggle(item.id)} className={`rounded-full px-3 py-2 text-xs font-semibold ${draft.dietTags.includes(item.id) ? 'bg-[#4F46E5] text-white' : 'bg-white text-slate-700'}`}>
            {item.label}
          </button>
        ))}
      </div>
      <Field label="Dieta principal, una sola">
        <select className="avi-input" value={draft.primaryDiet} onChange={(event) => patch({ primaryDiet: event.target.value })}>
          <option value="">Sin dieta principal</option>
          {DIET_TAGS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </Field>
    </>
  )
}

function PetsScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  const pet = draft.pets[0]
  const setPet = (partial: Partial<Draft['pets'][number]>) => {
    const current = pet || { name: '', species: 'perro', stage: 'adulto', food: 'seco' }
    patch({ pets: [{ ...current, ...partial }] })
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {[['perro', 'Perro'], ['gato', 'Gato']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setPet({ species: id, name: pet?.name || (id === 'gato' ? 'Gato' : 'Perro') })} className={`rounded-2xl py-4 text-sm font-bold ${pet?.species === id ? 'bg-[#4F46E5] text-white' : 'bg-white'}`}>
            {label}
          </button>
        ))}
      </div>
      {pet && (
        <>
          <Field label="Nombre">
            <input className="avi-input" value={pet.name} onChange={(event) => setPet({ name: event.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            {[['cachorro', 'Cachorro'], ['adulto', 'Adulto'], ['senior', 'Senior']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setPet({ stage: id })} className={`rounded-xl py-3 text-xs font-semibold ${pet.stage === id ? 'bg-[#0D9488] text-white' : 'bg-white'}`}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['seco', 'Alimento seco'], ['humedo', 'Alimento húmedo']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setPet({ food: id })} className={`rounded-xl py-3 text-sm font-semibold ${pet.food === id ? 'bg-[#F59E0B] text-white' : 'bg-white'}`}>{label}</button>
            ))}
          </div>
        </>
      )}
      {!pet && <p className="text-sm text-slate-500">Si no tienes mascota, continúa o salta este paso.</p>}
    </>
  )
}

function SubstitutionsScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  return (
    <>
      {SUBSTITUTION_MODES.map((mode) => (
        <Choice key={mode.id} active={draft.substitutionMode === mode.id} label={mode.label} hint={mode.hint} onClick={() => patch({ substitutionMode: mode.id })} />
      ))}
      {draft.substitutionMode === 'specific' && draft.replacements.map((value, index) => (
        <Field key={index} label={`Reemplazo ${index + 1}`}>
          <input
            className="avi-input"
            value={value}
            placeholder="Hasta 3"
            onChange={(event) => {
              const replacements = [...draft.replacements]
              replacements[index] = event.target.value
              patch({ replacements })
            }}
          />
        </Field>
      ))}
    </>
  )
}

function CadenceScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {CADENCES.map((item) => (
          <button key={item.id} type="button" onClick={() => patch({ cadence: item.id })} className={`rounded-2xl px-3 py-3 text-sm font-semibold ${draft.cadence === item.id ? 'bg-[#4F46E5] text-white' : 'bg-white'}`}>
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm font-medium">Día de entrega preferido</p>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => (
          <button key={day.id} type="button" onClick={() => patch({ deliveryDay: day.id })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${draft.deliveryDay === day.id ? 'bg-[#0D9488] text-white' : 'bg-white'}`}>
            {day.label}
          </button>
        ))}
      </div>
    </>
  )
}

function BudgetScreen({ draft, patch }: { draft: Draft; patch: (partial: Partial<Draft>) => void }) {
  const amounts = useMemo(() => PORTION_BUDGETS, [])
  return (
    <>
      <p className="text-sm font-medium">Presupuesto por porción</p>
      <div className="grid grid-cols-3 gap-2">
        {amounts.map((amount) => (
          <button key={amount} type="button" onClick={() => patch({ budget: draft.budget === amount ? null : amount })} className={`rounded-2xl py-4 text-sm font-bold ${draft.budget === amount ? 'bg-[#F59E0B] text-white' : 'bg-white'}`}>
            {clp(amount)}
          </button>
        ))}
      </div>
      <Field label="Presupuesto mensual (opcional)">
        <input className="avi-input" inputMode="numeric" value={draft.monthlyBudget} onChange={(event) => patch({ monthlyBudget: event.target.value })} placeholder="Vacío si no quieres tope" />
      </Field>
      <Field label="Tope por pedido (opcional)">
        <input className="avi-input" inputMode="numeric" value={draft.orderCap} onChange={(event) => patch({ orderCap: event.target.value })} placeholder="Vacío si no quieres tope" />
      </Field>
      <Choice active={draft.proposeAlcohol} label="AVI puede proponer alcohol" hint="Vino y pisco quedan fuera si lo apagas" onClick={() => patch({ proposeAlcohol: !draft.proposeAlcohol })} />
      <p className="rounded-2xl bg-indigo-50 px-4 py-3 text-xs leading-5 text-slate-600">
        El administrador del hogar aprueba el carro antes de comprar. AVI propone, la familia decide.
      </p>
    </>
  )
}
