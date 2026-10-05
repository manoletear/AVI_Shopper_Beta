'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Users, Plus, X, Crown, User, Baby,
  Heart, Dog, Copy, Check, Loader2, Share2,
  Mail, Shield, UserCheck, UserPlus, Link2,
} from 'lucide-react'

interface Member {
  id: string
  userId: string | null
  user: { email: string; name: string | null } | null
  name: string
  role: string
  type: string
  allergies: string | null
  dietType: string | null
  species: string | null
  breed: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
}

interface Family {
  id: string
  name: string
  inviteCode: string
  members: Member[]
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof User; color: string; bg: string }> = {
  master: { label: 'Administrador', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-100' },
  adult: { label: 'Adulto', icon: User, color: 'text-indigo-600', bg: 'bg-blue-100' },
  child: { label: 'Hijo/a', icon: Baby, color: 'text-purple-600', bg: 'bg-purple-100' },
  elder: { label: 'Adulto mayor', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-100' },
  pet: { label: 'Mascota', icon: Dog, color: 'text-orange-600', bg: 'bg-orange-100' },
}

const ALLERGY_OPTIONS = ['Gluten', 'Lactosa', 'Frutos secos', 'Mariscos', 'Huevo', 'Soya']

export default function FamiliaPage() {
  const { data: session } = useSession()
  const [family, setFamily] = useState<Family | null>(null)
  const [myRole, setMyRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('person')
  const [newRole, setNewRole] = useState('adult')
  const [newAllergies, setNewAllergies] = useState<string[]>([])
  const [newDiet, setNewDiet] = useState('')
  const [newSpecies, setNewSpecies] = useState('')
  const [newBreed, setNewBreed] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => { if (session) fetchFamily() }, [session])

  const fetchFamily = async () => {
    try {
      const res = await fetch('/api/family')
      const data = await res.json()
      if (data.success && data.data.family) {
        setFamily(data.data.family)
        setMyRole(data.data.myRole)
      }
    } catch {}
    setLoading(false)
  }

  const createFamily = async () => {
    const res = await fetch('/api/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', familyName: familyName || 'Mi Familia' }),
    })
    const data = await res.json()
    if (data.success) fetchFamily()
  }

  const joinFamily = async () => {
    if (!joinCode.trim()) return
    const res = await fetch('/api/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', inviteCode: joinCode.trim() }),
    })
    const data = await res.json()
    if (data.success) fetchFamily()
  }

  const addMember = async () => {
    if (!newName.trim()) return
    await fetch('/api/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_member',
        member: {
          name: newName, type: newType,
          role: newType === 'pet' ? 'pet' : newRole,
          allergies: newAllergies.length > 0 ? newAllergies : undefined,
          dietType: newDiet || undefined,
          species: newSpecies || undefined,
          breed: newBreed || undefined,
          notes: newNotes || undefined,
        },
      }),
    })
    setShowAdd(false)
    setNewName(''); setNewType('person'); setNewRole('adult')
    setNewAllergies([]); setNewDiet(''); setNewSpecies(''); setNewBreed(''); setNewNotes('')
    fetchFamily()
  }

  const removeMember = async (id: string) => {
    await fetch('/api/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_member', member: { id } }),
    })
    fetchFamily()
  }

  const inviteUrl = family ? `https://avi-shopper-beta.vercel.app/invitar/${family.inviteCode}` : ''

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="avi-page flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
    </div>
  )

  // Separar miembros conectados (con userId) de perfiles manuales
  const connectedMembers = family?.members.filter((m) => m.userId) || []
  const profileMembers = family?.members.filter((m) => !m.userId) || []

  return (
    <div className="avi-page min-h-screen pb-20">
      <header className="avi-header">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></a>
            <Users className="h-6 w-6 text-purple-600" />
            <h1 className="text-lg font-semibold">Mi Familia</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {!family ? (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Configura tu familia</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                AVI necesita conocer a tu familia para personalizar las compras, alertar alergenos y cuidar la nutricion de cada uno.
              </p>
            </div>

            <div className="avi-card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Crear mi familia</h3>
              <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Nombre (ej: Familia Garcia)" className="avi-input mb-3" />
              <button onClick={createFamily} className="avi-btn-primary w-full">Crear familia</button>
            </div>

            <div className="text-center text-sm text-gray-400">o</div>

            {showJoin ? (
              <div className="avi-card p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Unirse a una familia</h3>
                <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Codigo de invitacion" className="avi-input mb-3" />
                <div className="flex gap-2">
                  <button onClick={joinFamily} className="avi-btn-primary flex-1">Unirse</button>
                  <button onClick={() => setShowJoin(false)} className="avi-btn-secondary">Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowJoin(true)} className="avi-btn-secondary w-full">
                Tengo un codigo de invitacion
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Family header */}
            <div className="avi-card p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-gray-900">{family.name}</h2>
                <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                  {family.members.length} miembro{family.members.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {connectedMembers.length} conectado{connectedMembers.length !== 1 ? 's' : ''} · {profileMembers.length} perfil{profileMembers.length !== 1 ? 'es' : ''}
              </p>

              <button
                onClick={() => setShowInvite(!showInvite)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                {showInvite ? 'Ocultar invitacion' : 'Invitar a tu familia'}
              </button>
            </div>

            {/* Invite section */}
            {showInvite && (
              <div className="avi-card p-5 border-purple-200">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-purple-600" />
                  Invitar miembros
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Comparte el link. Cuando se registren y se unan, apareceran como "Conectados" y compartiran listas, presupuesto y compras.
                </p>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Unete a nuestra familia en AVI Shopper\n\n${inviteUrl}`)}`}
                    target="_blank"
                    className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-colors">
                    WhatsApp
                  </a>
                  <button onClick={copyLink}
                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                    {copied ? <><Check className="h-4 w-4 text-green-600" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar link</>}
                  </button>
                  <a href={`mailto:?subject=${encodeURIComponent('Unete a AVI Shopper')}&body=${encodeURIComponent(`Te invito a "${family.name}" en AVI Shopper:\n\n${inviteUrl}`)}`}
                    className="flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors">
                    <Mail className="h-4 w-4" /> Email
                  </a>
                  <a href={`sms:?body=${encodeURIComponent(`Unete a AVI Shopper: ${inviteUrl}`)}`}
                    className="flex items-center justify-center gap-2 py-2.5 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors">
                    SMS
                  </a>
                </div>

                {connectedMembers.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-800 mb-1">
                      {connectedMembers.length} persona{connectedMembers.length > 1 ? 's' : ''} aceptaron la invitacion
                    </p>
                    <div className="space-y-1">
                      {connectedMembers.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-xs text-green-700">
                          <Check className="h-3 w-3" />
                          <span className="font-medium">{m.name}</span>
                          {m.user?.email && <span className="text-green-500">({m.user.email})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Connected members (users with accounts) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Conectados ({connectedMembers.length})
              </h3>
              <div className="space-y-2">
                {connectedMembers.map((m) => {
                  const config = ROLE_CONFIG[m.role] || ROLE_CONFIG.adult
                  const Icon = config.icon
                  return (
                    <div key={m.id} className="avi-card p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{m.name}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>{config.label}</span>
                          </div>
                          {m.user?.email && (
                            <p className="text-xs text-gray-400">{m.user.email}</p>
                          )}
                          <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5 mt-0.5">
                            <Check className="h-2.5 w-2.5" /> Conectado — comparte listas y compras
                          </span>
                        </div>
                        {myRole === 'master' && m.role !== 'master' && (
                          <button onClick={() => removeMember(m.id)} className="text-gray-300 hover:text-red-500 p-1">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Family profiles (manually added — children, elderly, pets) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Perfiles familiares ({profileMembers.length})
              </h3>
              <p className="text-xs text-gray-400 mb-3 -mt-1">
                Personas o mascotas que no usan la app pero AVI cuida su nutricion y alergenos
              </p>

              {profileMembers.length === 0 && !showAdd && (
                <div className="avi-card p-6 text-center">
                  <Baby className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin perfiles agregados</p>
                  <p className="text-xs text-gray-400 mt-0.5">Agrega hijos, adultos mayores o mascotas</p>
                </div>
              )}

              <div className="space-y-2">
                {profileMembers.map((m) => {
                  const config = ROLE_CONFIG[m.role] || ROLE_CONFIG.adult
                  const Icon = config.icon
                  const allergies = m.allergies ? JSON.parse(m.allergies) : []

                  return (
                    <div key={m.id} className="avi-card p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{m.name}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>{config.label}</span>
                          </div>
                          {m.type === 'pet' && m.species && (
                            <p className="text-xs text-gray-500">{m.species}{m.breed ? ` · ${m.breed}` : ''}</p>
                          )}
                          {m.dietType && (
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full mt-1 inline-block">{m.dietType}</span>
                          )}
                          {allergies.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {allergies.map((a: string) => (
                                <span key={a} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">⚠ {a}</span>
                              ))}
                            </div>
                          )}
                          {m.notes && <p className="text-xs text-gray-400 mt-1">{m.notes}</p>}
                        </div>
                        {myRole === 'master' && (
                          <button onClick={() => removeMember(m.id)} className="text-gray-300 hover:text-red-500 p-1">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Add member form */}
            {myRole === 'master' && (
              showAdd ? (
                <div className="avi-card p-5 space-y-4">
                  <h3 className="font-semibold text-gray-900">Agregar perfil familiar</h3>
                  <p className="text-xs text-gray-400 -mt-2">Para personas que no usan la app (hijos, abuelos) o mascotas</p>

                  <div className="flex gap-2">
                    {[
                      { value: 'person', label: 'Persona' },
                      { value: 'pet', label: 'Mascota' },
                    ].map((t) => (
                      <button key={t.value} onClick={() => setNewType(t.value)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                          newType === t.value ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder={newType === 'pet' ? 'Nombre de la mascota' : 'Nombre'} className="avi-input" />

                  {newType === 'person' ? (
                    <>
                      <div className="flex gap-2">
                        {['adult', 'child', 'elder'].map((r) => (
                          <button key={r} onClick={() => setNewRole(r)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 ${
                              newRole === r ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'
                            }`}>
                            {r === 'adult' ? 'Adulto' : r === 'child' ? 'Hijo/a' : 'Adulto mayor'}
                          </button>
                        ))}
                      </div>
                      <select value={newDiet} onChange={(e) => setNewDiet(e.target.value)} className="avi-input">
                        <option value="">Sin restriccion alimentaria</option>
                        <option value="vegetarian">Vegetariano</option>
                        <option value="vegan">Vegano</option>
                        <option value="keto">Keto</option>
                        <option value="diabetic">Diabetico</option>
                        <option value="celiac">Celiaco</option>
                      </select>
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Alergias</p>
                        <div className="flex flex-wrap gap-2">
                          {ALLERGY_OPTIONS.map((a) => (
                            <button key={a} onClick={() => setNewAllergies((prev) =>
                              prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                            )} className={`text-xs px-3 py-1.5 rounded-full border-2 ${
                              newAllergies.includes(a) ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'
                            }`}>
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <input type="text" value={newSpecies} onChange={(e) => setNewSpecies(e.target.value)}
                        placeholder="Tipo (perro, gato, etc)" className="avi-input" />
                      <input type="text" value={newBreed} onChange={(e) => setNewBreed(e.target.value)}
                        placeholder="Raza (opcional)" className="avi-input" />
                    </>
                  )}

                  <input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Notas (opcional)" className="avi-input" />

                  <div className="flex gap-2">
                    <button onClick={addMember} disabled={!newName.trim()} className="avi-btn-primary flex-1">Agregar</button>
                    <button onClick={() => setShowAdd(false)} className="avi-btn-secondary">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAdd(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors">
                  <Plus className="h-5 w-5" /> Agregar perfil familiar
                </button>
              )
            )}
            {/* Confirm family is complete */}
            <div className="mt-6 avi-card p-5 text-center">
              <p className="text-sm text-gray-600 mb-3">
                ¿Tu familia ya esta configurada?
              </p>
              <button
                onClick={() => {
                  try { localStorage.setItem('avi-family-confirmed', 'true') } catch {}
                  window.location.href = '/dashboard'
                }}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform hover:bg-indigo-700"
              >
                Mi familia esta lista
              </button>
              <p className="text-xs text-gray-400 mt-2">Siempre puedes volver a agregar miembros</p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
