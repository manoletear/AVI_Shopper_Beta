'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Heart, Shield, AlertTriangle, Check,
  Plus, X, Save, Loader2, Apple, Settings,
} from 'lucide-react'

const DIET_OPTIONS = [
  { value: '', label: 'Sin restriccion', description: 'Como de todo' },
  { value: 'vegetarian', label: 'Vegetariano', description: 'Sin carnes' },
  { value: 'vegan', label: 'Vegano', description: 'Sin productos animales' },
  { value: 'keto', label: 'Keto', description: 'Bajo en carbohidratos, alto en grasa' },
  { value: 'diabetic', label: 'Diabetico', description: 'Control de azucar y carbohidratos' },
  { value: 'celiac', label: 'Celiaco', description: 'Sin gluten' },
  { value: 'low-sodium', label: 'Bajo en sodio', description: 'Control de sal' },
  { value: 'mediterranean', label: 'Mediterranea', description: 'Equilibrada, aceite de oliva, pescado' },
]

const COMMON_ALLERGENS = [
  { id: 'gluten', label: 'Gluten', icon: '🌾', examples: 'Pan, fideos, galletas, harina de trigo' },
  { id: 'lactosa', label: 'Lactosa', icon: '🥛', examples: 'Leche, queso, yogurt, helado' },
  { id: 'frutos_secos', label: 'Frutos secos', icon: '🥜', examples: 'Mani, nueces, almendras, avellanas' },
  { id: 'mariscos', label: 'Mariscos', icon: '🦐', examples: 'Camarones, jaiba, cholgas, almejas' },
  { id: 'huevo', label: 'Huevo', icon: '🥚', examples: 'Huevos, mayonesa, merengue' },
  { id: 'soya', label: 'Soya', icon: '🫘', examples: 'Salsa de soya, tofu, leche de soya' },
]

const HEALTH_GOALS = [
  { id: 'reduce_sugar', label: 'Reducir azucar', description: 'AVI te alerta cuando un producto tiene mucha azucar' },
  { id: 'reduce_fat', label: 'Reducir grasa', description: 'Prioriza productos bajos en grasa' },
  { id: 'reduce_sodium', label: 'Reducir sodio', description: 'Evita productos con exceso de sal' },
  { id: 'avoid_ultraprocessed', label: 'Evitar ultra-procesados', description: 'AVI detecta y sugiere alternativas naturales' },
  { id: 'more_fiber', label: 'Mas fibra', description: 'Sugiere productos integrales y legumbres' },
  { id: 'more_protein', label: 'Mas proteina', description: 'Prioriza alimentos ricos en proteina' },
]

export default function PerfilNutricionalPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [dietType, setDietType] = useState('')
  const [allergies, setAllergies] = useState<string[]>([])
  const [customAllergen, setCustomAllergen] = useState('')
  const [healthGoals, setHealthGoals] = useState<string[]>([])
  const [familySize, setFamilySize] = useState(1)

  useEffect(() => {
    if (!session) return
    fetch('/api/users/preferences')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setDietType(data.data.dietType || '')
          setAllergies(data.data.allergies || [])
          // healthGoals y familySize se guardarian en favorites como JSON
          if (data.data.favorites && Array.isArray(data.data.favorites)) {
            const meta = data.data.favorites.find((f: string) => f.startsWith('meta:'))
            if (meta) {
              try {
                const parsed = JSON.parse(meta.replace('meta:', ''))
                setHealthGoals(parsed.healthGoals || [])
                setFamilySize(parsed.familySize || 1)
              } catch {}
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  const toggleAllergen = (id: string) => {
    setAllergies((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
    setSaved(false)
  }

  const addCustomAllergen = () => {
    const trimmed = customAllergen.trim().toLowerCase()
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies((prev) => [...prev, trimmed])
      setCustomAllergen('')
      setSaved(false)
    }
  }

  const toggleGoal = (id: string) => {
    setHealthGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    )
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const meta = JSON.stringify({ healthGoals, familySize })
      await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dietType: dietType || null,
          allergies,
          favorites: [`meta:${meta}`],
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Heart className="h-8 w-8 text-red-400 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="avi-page min-h-screen pb-20">
      <header className="avi-header">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <Heart className="h-6 w-6 text-red-500" />
            <h1 className="text-lg font-semibold">Mi Perfil Nutricional</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saved
                ? 'bg-green-100 text-green-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
            }`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{saved ? 'Guardado' : 'Guardar'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Info */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start space-x-3">
          <Shield className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-800 font-medium">AVI usa tu perfil para protegerte</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Te alerta cuando un producto contiene alergenos, sugiere alternativas mas saludables
              segun tu dieta, y adapta las recomendaciones a tu familia.
            </p>
          </div>
        </div>

        {/* Tipo de Dieta */}
        <div className="avi-card p-5">
          <div className="flex items-center space-x-2 mb-4">
            <Apple className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-gray-900">Tipo de Dieta</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {DIET_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => { setDietType(option.value); setSaved(false) }}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  dietType === option.value
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{option.label}</span>
                  {dietType === option.value && <Check className="h-4 w-4 text-green-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Alergias */}
        <div className="avi-card p-5">
          <div className="flex items-center space-x-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-gray-900">Alergias e Intolerancias</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">AVI te alertara cuando un producto contenga estos alergenos</p>

          <div className="grid sm:grid-cols-2 gap-2 mb-4">
            {COMMON_ALLERGENS.map((allergen) => {
              const isActive = allergies.includes(allergen.id)
              return (
                <button
                  key={allergen.id}
                  onClick={() => toggleAllergen(allergen.id)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{allergen.icon}</span>
                      <span className="text-sm font-medium text-gray-900">{allergen.label}</span>
                    </div>
                    {isActive && <Check className="h-4 w-4 text-red-500" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 ml-7">{allergen.examples}</p>
                </button>
              )
            })}
          </div>

          {/* Custom allergens */}
          {allergies.filter((a) => !COMMON_ALLERGENS.find((c) => c.id === a)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {allergies
                .filter((a) => !COMMON_ALLERGENS.find((c) => c.id === a))
                .map((a) => (
                  <span key={a} className="inline-flex items-center bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full">
                    {a}
                    <button onClick={() => toggleAllergen(a)} className="ml-1.5 hover:text-red-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}

          <div className="flex space-x-2">
            <input
              type="text"
              value={customAllergen}
              onChange={(e) => setCustomAllergen(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomAllergen()}
              placeholder="Agregar otra alergia..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={addCustomAllergen}
              disabled={!customAllergen.trim()}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Objetivos de Salud */}
        <div className="avi-card p-5">
          <div className="flex items-center space-x-2 mb-1">
            <Settings className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-gray-900">Objetivos de Salud</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">AVI adapta las alertas y recomendaciones segun tus objetivos</p>

          <div className="space-y-2">
            {HEALTH_GOALS.map((goal) => {
              const isActive = healthGoals.includes(goal.id)
              return (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'border-blue-400 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{goal.label}</span>
                    {isActive && <Check className="h-4 w-4 text-indigo-600" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{goal.description}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tamaño Familia */}
        <div className="avi-card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Tamaño de la Familia</h2>
          <p className="text-xs text-gray-500 mb-3">AVI ajusta las cantidades y predicciones de consumo</p>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => { setFamilySize(Math.max(1, familySize - 1)); setSaved(false) }}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:border-indigo-500 hover:text-indigo-600"
            >
              -
            </button>
            <div className="text-center">
              <span className="text-3xl font-bold text-gray-900">{familySize}</span>
              <p className="text-xs text-gray-400">persona{familySize > 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => { setFamilySize(familySize + 1); setSaved(false) }}
              className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:border-indigo-500 hover:text-indigo-600"
            >
              +
            </button>
          </div>
        </div>

        {/* Next steps */}
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-800 font-medium mb-2">Perfil guardado</p>
            <div className="flex flex-col gap-2">
              <a href="/familia" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                → Configurar tu familia (alergias, hijos, mascotas)
              </a>
              <a href="/presupuesto" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                → Definir tu presupuesto mensual
              </a>
              <a href="/listas" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                → Crear tu primera lista de compras
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
