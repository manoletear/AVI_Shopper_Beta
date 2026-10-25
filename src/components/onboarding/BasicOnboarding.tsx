'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BASIC_ALLERGEN_OPTIONS,
  BasicAllergen,
  BasicAnswers,
  CHILD_AGES,
  HOUSING_OPTIONS,
  HousingType,
  PET_AGES,
  PET_SIZES,
  PET_SPECIES,
  SEX_OPTIONS,
  STORE_CHAINS,
  STORE_OPTIONS,
  addressStepSchema,
  allergiesStepSchema,
  emptyHousehold,
  firstZodMessage,
  householdStepSchema,
  petDraftSchema,
  storesStepSchema,
  withAdults,
  withNana,
  withPeople,
  type MemberDraft,
  type PetDraft,
} from '@/lib/onboarding/basic'

type Screen =
  | 'address'
  | 'people'
  | 'nana'
  | 'split'
  | 'names'
  | 'pets'
  | 'pet-detail'
  | 'allergies'
  | 'allergy-who'
  | 'stores'
  | 'approver'

const STEP_OF: Record<Screen, number> = {
  address: 1,
  people: 2,
  nana: 2,
  split: 2,
  names: 2,
  pets: 2,
  'pet-detail': 2,
  allergies: 3,
  'allergy-who': 3,
  stores: 4,
  approver: 5,
}

const TITLE: Record<Screen, string> = {
  address: 'Dirección y acceso',
  people: '¿Cuántas personas?',
  nana: '¿Hay nana o asesora?',
  split: 'Adultos y niños',
  names: '¿Cómo se llaman?',
  pets: '¿Mascotas?',
  'pet-detail': 'Tu mascota',
  allergies: 'Alergias',
  'allergy-who': '¿Quién las tiene?',
  stores: 'Tiendas',
  approver: '¿Quién aprueba el carro?',
}

const ACCESS_HINT: Record<HousingType, string> = {
  casa: 'Timbre, portón o dejar en la puerta',
  'casa en condominio': 'Conserjería o código del portón',
  departamento: 'Piso, depto y conserjería',
}

type Draft = BasicAnswers & { wantPet: boolean; pet: PetDraft }

function draftFrom(selfName: string, answers: Partial<BasicAnswers>): Draft {
  const household = answers.household || emptyHousehold(selfName)
  const pet = household.pets[0] || { species: 'perro' as const, breed: '', size: 'mediano' as const, age: 'adulto' as const, name: '' }
  return {
    address: answers.address || {
      street: '', number: '', unit: '', comuna: '', housingType: 'casa', accessNote: '',
    },
    household,
    allergies: answers.allergies || { allergens: ['ninguna'], assignments: [] },
    stores: answers.stores || { chains: [...STORE_CHAINS] },
    approver: answers.approver || { memberName: household.members.find((member) => member.kind === 'adult')?.name || selfName },
    wantPet: household.pets.length > 0,
    pet,
  }
}

function resume(answers: Partial<BasicAnswers>): Screen {
  if (!answers.address) return 'address'
  if (!answers.household) return 'people'
  if (!answers.allergies) return 'allergies'
  if (!answers.stores) return 'stores'
  return 'approver'
}

function householdPayload(draft: Draft) {
  return { ...draft.household, pets: draft.wantPet ? [draft.pet] : [] }
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => null)
  if (!json?.success) throw new Error(json?.error?.message || 'No pude guardar')
  return json.data
}

export default function BasicOnboarding({ editing = false }: { editing?: boolean }) {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('address')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selfName, setSelfName] = useState('Yo')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/onboarding/basic')
      .then((response) => response.json())
      .then((body) => {
        if (!active) return
        if (!body?.success) {
          router.replace('/login')
          return
        }
        if (!body.data.needsOnboarding && body.data.onboardingStep === 'basic_done' && !editing) {
          router.replace('/dashboard')
          return
        }
        const name = body.data.selfName || 'Yo'
        setSelfName(name)
        setDraft(draftFrom(name, body.data.answers || {}))
        if (!editing) setScreen(resume(body.data.answers || {}))
      })
      .catch(() => router.replace('/login'))
    return () => { active = false }
  }, [editing, router])

  const patch = (partial: Partial<Draft>) => setDraft((current) => current ? { ...current, ...partial } : current)

  const fail = (message: string) => {
    setError(message)
    setSaving(false)
  }

  const saveStep = async (step: 'address' | 'household' | 'allergies' | 'stores', payload: unknown) => {
    await postJson(`/api/onboarding/steps/${step}`, payload)
  }

  const go = async () => {
    if (!draft) return
    setError('')
    setSaving(true)
    try {
      if (screen === 'address') {
        const parsed = addressStepSchema.safeParse(draft.address)
        if (!parsed.success) return fail(firstZodMessage(parsed.error))
        await saveStep('address', parsed.data)
        patch({ address: parsed.data })
        setScreen('people')
      } else if (screen === 'people') {
        setScreen('nana')
      } else if (screen === 'nana') {
        if (draft.household.hasNana && !draft.household.nanaMode) return fail('Elige si es puertas adentro o afuera.')
        setScreen('split')
      } else if (screen === 'split') {
        setScreen('names')
      } else if (screen === 'names') {
        const parsed = householdStepSchema.safeParse({ ...draft.household, pets: [] })
        if (!parsed.success) return fail(firstZodMessage(parsed.error))
        patch({ household: { ...parsed.data, pets: draft.household.pets } })
        setScreen('pets')
      } else if (screen === 'pets') {
        if (draft.wantPet) {
          setScreen('pet-detail')
        } else {
          const payload = { ...draft.household, pets: [] }
          const parsed = householdStepSchema.safeParse(payload)
          if (!parsed.success) return fail(firstZodMessage(parsed.error))
          await saveStep('household', parsed.data)
          patch({ household: parsed.data })
          setScreen('allergies')
        }
      } else if (screen === 'pet-detail') {
        const pet = petDraftSchema.safeParse(draft.pet)
        if (!pet.success) return fail(firstZodMessage(pet.error))
        const payload = { ...draft.household, pets: [pet.data] }
        const parsed = householdStepSchema.safeParse(payload)
        if (!parsed.success) return fail(firstZodMessage(parsed.error))
        await saveStep('household', parsed.data)
        patch({ household: parsed.data, pet: pet.data })
        setScreen('allergies')
      } else if (screen === 'allergies') {
        const real = draft.allergies.allergens.filter((id) => id !== 'ninguna')
        if (!real.length) {
          const parsed = allergiesStepSchema.safeParse({ allergens: ['ninguna'], assignments: [] })
          if (!parsed.success) return fail(firstZodMessage(parsed.error))
          await saveStep('allergies', parsed.data)
          patch({ allergies: parsed.data })
          setScreen('stores')
        } else {
          setScreen('allergy-who')
        }
      } else if (screen === 'allergy-who') {
        const parsed = allergiesStepSchema.safeParse(draft.allergies)
        if (!parsed.success) return fail(firstZodMessage(parsed.error))
        await saveStep('allergies', parsed.data)
        patch({ allergies: parsed.data })
        setScreen('stores')
      } else if (screen === 'stores') {
        const parsed = storesStepSchema.safeParse(draft.stores)
        if (!parsed.success) return fail(firstZodMessage(parsed.error))
        await saveStep('stores', parsed.data)
        const approverName = draft.household.members.some((member) => member.kind !== 'child' && member.name === draft.approver.memberName)
          ? draft.approver.memberName
          : draft.household.members.find((member) => member.kind === 'adult')?.name || selfName
        patch({ stores: parsed.data, approver: { ...draft.approver, memberName: approverName } })
        setScreen('approver')
      } else if (screen === 'approver') {
        const body = {
          address: draft.address,
          household: householdPayload(draft),
          allergies: draft.allergies,
          stores: draft.stores,
          approver: { memberName: draft.approver.memberName, memberId: draft.approver.memberId },
        }
        await postJson('/api/onboarding/basic', body)
        router.push(editing ? '/dashboard' : '/cart-assistant')
        return
      }
      setSaving(false)
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : 'No pude guardar')
    }
  }

  const back = () => {
    setError('')
    const order: Screen[] = ['address', 'people', 'nana', 'split', 'names', 'pets', 'pet-detail', 'allergies', 'allergy-who', 'stores', 'approver']
    const index = order.indexOf(screen)
    if (index <= 0 || !draft) return
    if (screen === 'allergies') {
      setScreen(draft.wantPet ? 'pet-detail' : 'pets')
      return
    }
    if (screen === 'stores') {
      const real = draft.allergies.allergens.some((id) => id !== 'ninguna')
      setScreen(real ? 'allergy-who' : 'allergies')
      return
    }
    if (screen === 'pet-detail') {
      setScreen('pets')
      return
    }
    setScreen(order[index - 1])
  }

  if (!draft) {
    return <main className="min-h-screen bg-[#F8FAFC] px-4 py-10 text-sm text-slate-500">Cargando tu hogar…</main>
  }

  const step = STEP_OF[screen]
  const approvers = draft.household.members.filter((member) => member.kind !== 'child' && member.name)
  const space = draft.household.people - (draft.household.hasNana ? 1 : 0)

  return (
    <main className="mx-auto flex h-screen w-full max-w-md flex-col bg-[#F8FAFC] text-[#0F172A]" data-screen={screen}>
      <div data-testid="onboarding-scroll" className="flex-1 overflow-y-auto px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Paso {step} de 5</span>
          {screen !== 'address' && (
            <button type="button" onClick={back} className="text-[#4F46E5]">Atrás</button>
          )}
        </div>
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${(step / 5) * 100}%` }} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="onboarding-title">{TITLE[screen]}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{hintFor(screen)}</p>
        <div className="mt-5 space-y-3">
          {screen === 'address' && (
            <>
              {HOUSING_OPTIONS.map((option) => (
                <Option
                  key={option.id}
                  active={draft.address.housingType === option.id}
                  label={option.label}
                  hint={option.hint}
                  recommended={option.recommended}
                  onClick={() => patch({ address: { ...draft.address, housingType: option.id } })}
                />
              ))}
              <Field label="Calle">
                <input className="avi-input" placeholder="Los Leones" value={draft.address.street} onChange={(event) => patch({ address: { ...draft.address, street: event.target.value } })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Número">
                  <input className="avi-input" placeholder="123" value={draft.address.number} onChange={(event) => patch({ address: { ...draft.address, number: event.target.value } })} />
                </Field>
                <Field label="Depto">
                  <input className="avi-input" placeholder="Depto 402" value={draft.address.unit || ''} onChange={(event) => patch({ address: { ...draft.address, unit: event.target.value } })} />
                </Field>
              </div>
              <Field label="Comuna">
                <input className="avi-input" placeholder="Providencia" value={draft.address.comuna} onChange={(event) => patch({ address: { ...draft.address, comuna: event.target.value } })} />
              </Field>
              <Field label="Cómo entramos">
                <input className="avi-input" placeholder={ACCESS_HINT[draft.address.housingType]} value={draft.address.accessNote || ''} onChange={(event) => patch({ address: { ...draft.address, accessNote: event.target.value } })} />
              </Field>
            </>
          )}

          {screen === 'people' && (
            <div className="grid grid-cols-4 gap-2">
              {[2, 1, 3, 4, 5, 6, 7, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => patch({ household: withPeople(draft.household, count, selfName) })}
                  className={`rounded-2xl py-4 text-lg font-bold ${draft.household.people === count ? 'bg-[#4F46E5] text-white' : 'bg-white text-slate-800'}`}
                >
                  {count}
                  {count === 2 && <span className="mt-0.5 block text-[10px] font-semibold uppercase">Ideal</span>}
                </button>
              ))}
            </div>
          )}

          {screen === 'nana' && (
            <>
              <Option active={!draft.household.hasNana} label="No" hint="Nadie más recibe el pedido" recommended onClick={() => patch({ household: withNana(draft.household, 'no', selfName) })} />
              <Option active={draft.household.hasNana && draft.household.nanaMode === 'adentro'} label="Puertas adentro" hint="Vive en la casa. Cuenta en las cantidades y puede recibir." onClick={() => patch({ household: withNana(draft.household, 'adentro', selfName) })} />
              <Option active={draft.household.hasNana && draft.household.nanaMode === 'afuera'} label="Puertas afuera" hint="Viene por el día. Cuenta en las cantidades y puede recibir." onClick={() => patch({ household: withNana(draft.household, 'afuera', selfName) })} />
            </>
          )}

          {screen === 'split' && (
            <>
              <p className="text-sm text-slate-600">Adultos. Niños: {draft.household.children}{draft.household.hasNana ? '. La nana ya va contada.' : '.'}</p>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: space }, (_, index) => index + 1).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => patch({ household: withAdults(draft.household, count, selfName) })}
                    className={`rounded-2xl py-4 text-lg font-bold ${draft.household.adults === count ? 'bg-[#4F46E5] text-white' : 'bg-white'}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </>
          )}

          {screen === 'names' && draft.household.members.map((member, index) => (
            <MemberCard
              key={`${member.kind}-${index}`}
              member={member}
              onChange={(next) => {
                const members = draft.household.members.map((item, itemIndex) => itemIndex === index ? next : item)
                patch({ household: { ...draft.household, members } })
              }}
            />
          ))}

          {screen === 'pets' && (
            <>
              <Option active={!draft.wantPet} label="Sin mascotas" recommended onClick={() => patch({ wantPet: false, household: { ...draft.household, pets: [] } })} />
              <Option active={draft.wantPet} label="Sí, hay mascota" hint="Especie, raza, tamaño y edad" onClick={() => patch({ wantPet: true })} />
            </>
          )}

          {screen === 'pet-detail' && (
            <PetCard pet={draft.pet} onChange={(pet) => patch({ pet })} />
          )}

          {screen === 'allergies' && (
            <div className="grid grid-cols-2 gap-2">
              {BASIC_ALLERGEN_OPTIONS.map((option) => {
                const active = draft.allergies.allergens.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => patch({ allergies: toggleAllergen(draft.allergies, option.id) })}
                    className={`rounded-2xl px-3 py-3 text-left text-sm font-semibold ${active ? (option.id === 'ninguna' ? 'bg-[#0D9488] text-white' : 'bg-[#E11D48] text-white') : 'bg-white text-slate-800'}`}
                  >
                    {option.label}
                    {option.recommended && !active && <span className="mt-1 block text-[10px] font-bold uppercase text-[#F59E0B]">Recomendado</span>}
                  </button>
                )
              })}
            </div>
          )}

          {screen === 'allergy-who' && draft.allergies.allergens.filter((id) => id !== 'ninguna').map((allergen) => (
            <div key={allergen} className="rounded-2xl bg-white p-3">
              <p className="text-sm font-semibold">{BASIC_ALLERGEN_OPTIONS.find((item) => item.id === allergen)?.label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.household.members.filter((member) => member.name).map((member) => {
                  const active = draft.allergies.assignments.some((row) => row.allergen === allergen && row.memberName === member.name)
                  return (
                    <button
                      key={member.name}
                      type="button"
                      onClick={() => patch({ allergies: toggleAssignment(draft.allergies, allergen, member.name) })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-[#4F46E5] text-white' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {member.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {screen === 'stores' && (
            <div className="grid grid-cols-2 gap-2">
              {STORE_OPTIONS.map((store) => {
                const active = draft.stores.chains.includes(store.id)
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => {
                      const chains = active
                        ? draft.stores.chains.filter((id) => id !== store.id)
                        : [...draft.stores.chains, store.id]
                      if (!chains.length) return
                      patch({ stores: { chains } })
                    }}
                    className={`rounded-2xl py-5 text-sm font-bold ${active ? 'bg-[#4F46E5] text-white' : 'bg-white text-slate-500'}`}
                  >
                    {store.label}
                  </button>
                )
              })}
            </div>
          )}

          {screen === 'approver' && approvers.map((member, index) => (
            <Option
              key={`${member.name}-${index}`}
              active={draft.approver.memberName === member.name}
              label={member.name}
              hint={member.kind === 'nana' ? 'Puede recibir el pedido' : undefined}
              recommended={index === 0}
              onClick={() => patch({ approver: { memberName: member.name, memberId: member.id } })}
            />
          ))}
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      </div>
      <footer className="border-t border-slate-200 bg-white px-4 py-3">
        <button type="button" data-testid="onboarding-continue" disabled={saving} onClick={go} className="avi-btn-primary w-full">
          {saving ? 'Guardando…' : screen === 'approver' ? 'Guardar y armar el primer carro' : 'Continuar'}
        </button>
      </footer>
    </main>
  )
}

function hintFor(screen: Screen): string {
  if (screen === 'address') return 'Dónde dejar el pedido.'
  if (screen === 'people') return 'Quienes comen en la casa, nana incluida.'
  if (screen === 'nana') return 'Si hay nana, entra en las cantidades y puede recibir.'
  if (screen === 'split') return 'Un toque. Los niños quedan al resto.'
  if (screen === 'names') return 'La edad del niño importa. El sexo es opcional.'
  if (screen === 'pets') return 'Si no hay, sigue no más.'
  if (screen === 'pet-detail') return 'Especie, raza, tamaño y edad.'
  if (screen === 'allergies') return 'AVI avisa en el carro. No bloquea la compra.'
  if (screen === 'allergy-who') return 'Cada alergia queda en esa persona.'
  if (screen === 'stores') return 'Partimos con las cuatro. Saca la que no uses.'
  return 'Esa persona da el ok antes de comprar.'
}

function toggleAllergen(current: Draft['allergies'], id: BasicAllergen): Draft['allergies'] {
  if (id === 'ninguna') return { allergens: ['ninguna'], assignments: [] }
  const withoutNone = current.allergens.filter((item) => item !== 'ninguna')
  const allergens = withoutNone.includes(id) ? withoutNone.filter((item) => item !== id) : [...withoutNone, id]
  if (!allergens.length) return { allergens: ['ninguna'], assignments: [] }
  const chosen = new Set<string>(allergens)
  return {
    allergens,
    assignments: current.assignments.filter((row) => chosen.has(row.allergen)),
  }
}

function toggleAssignment(current: Draft['allergies'], allergen: BasicAllergen, memberName: string): Draft['allergies'] {
  const exists = current.assignments.some((row) => row.allergen === allergen && row.memberName === memberName)
  const assignments = exists
    ? current.assignments.filter((row) => !(row.allergen === allergen && row.memberName === memberName))
    : [...current.assignments, { allergen, memberName }]
  return { ...current, assignments }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function Option({
  active, label, hint, recommended, onClick,
}: {
  active: boolean
  label: string
  hint?: string
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-2xl border px-4 py-3 text-left ${active ? 'border-[#4F46E5] bg-indigo-50' : 'border-slate-200 bg-white'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {recommended && <span className="shrink-0 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[10px] font-bold text-white">Recomendado</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
    </button>
  )
}

function MemberCard({ member, onChange }: { member: MemberDraft; onChange: (member: MemberDraft) => void }) {
  const title = member.kind === 'nana' ? 'Nana o asesora' : member.kind === 'child' ? 'Niño' : 'Adulto'
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="mb-2 text-xs font-semibold text-slate-500">{title}</p>
      <input className="avi-input" placeholder="Nombre" value={member.name} onChange={(event) => onChange({ ...member, name: event.target.value })} />
      {member.kind === 'child' && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {CHILD_AGES.map((age) => (
            <button key={age.id} type="button" onClick={() => onChange({ ...member, ageRange: age.id })} className={`rounded-xl py-2 text-xs font-semibold ${member.ageRange === age.id ? 'bg-[#0D9488] text-white' : 'bg-slate-100'}`}>
              {age.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        {SEX_OPTIONS.map((sex) => (
          <button
            key={sex.id}
            type="button"
            onClick={() => onChange({ ...member, sex: member.sex === sex.id ? null : sex.id })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${member.sex === sex.id ? 'bg-[#4F46E5] text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {sex.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PetCard({ pet, onChange }: { pet: PetDraft; onChange: (pet: PetDraft) => void }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {PET_SPECIES.map((species) => (
          <button key={species.id} type="button" onClick={() => onChange({ ...pet, species: species.id })} className={`rounded-2xl py-3 text-sm font-bold ${pet.species === species.id ? 'bg-[#4F46E5] text-white' : 'bg-white'}`}>
            {species.label}
          </button>
        ))}
      </div>
      <Field label="Raza, si la sabes">
        <input className="avi-input" placeholder="Quiltro, siamés…" value={pet.breed || ''} onChange={(event) => onChange({ ...pet, breed: event.target.value })} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        {PET_SIZES.map((size) => (
          <button key={size.id} type="button" onClick={() => onChange({ ...pet, size: size.id })} className={`rounded-xl py-3 text-xs font-semibold ${pet.size === size.id ? 'bg-[#0D9488] text-white' : 'bg-white'}`}>
            {size.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PET_AGES.map((age) => (
          <button key={age.id} type="button" onClick={() => onChange({ ...pet, age: age.id })} className={`rounded-xl py-3 text-xs font-semibold ${pet.age === age.id ? 'bg-[#F59E0B] text-white' : 'bg-white'}`}>
            {age.label}
          </button>
        ))}
      </div>
    </>
  )
}
