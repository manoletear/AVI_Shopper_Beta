'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ArrowRight, Tag } from 'lucide-react'
import { PROJECTS, CATEGORIES } from '@/data/projects'

export default function ProyectosActivosPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('todos')

  const filteredProjects = useMemo(() => {
    return PROJECTS.filter((project) => {
      const matchesSearch =
        searchQuery === '' ||
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        )

      const matchesCategory =
        activeCategory === 'todos' || project.category === activeCategory

      return matchesSearch && matchesCategory
    })
  }, [searchQuery, activeCategory])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-6">
        <span>comunidad</span>
        <span className="mx-1.5">&gt;</span>
        <span>bóveda</span>
        <span className="mx-1.5">&gt;</span>
        <span className="text-gray-600">proyectos activos</span>
      </nav>

      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        Proyectos activos
      </h1>

      {/* Subtitle */}
      <p className="text-gray-500 text-sm mb-4 max-w-2xl">
        aquí tienes todos los proyectos de la comunidad que están en ejecución.
        usa el buscador para encontrar uno por nombre, categoría o palabra clave.
      </p>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 mb-8">
        <p className="text-xs text-gray-400">
          este contenido es para la comunidad de tododeia y no está autorizada su
          reventa, redistribución ni comercialización.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar proyecto"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent placeholder:text-gray-400"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === category.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Project Count */}
      <p className="text-sm text-gray-400 mb-8">
        {filteredProjects.length} proyecto{filteredProjects.length !== 1 ? 's' : ''} activo{filteredProjects.length !== 1 ? 's' : ''} disponible{filteredProjects.length !== 1 ? 's' : ''}
      </p>

      {/* Project Cards */}
      <div className="space-y-0 divide-y divide-gray-100">
        {filteredProjects.map((project) => (
          <div key={project.id} className="py-6 first:pt-0">
            {/* Title */}
            <h3 className="text-base font-semibold text-gray-900 mb-1.5">
              {project.title}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-500 mb-3">
              {project.description}
            </p>

            {/* Tags */}
            <div className="flex items-start gap-1.5 mb-4 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Action */}
            <Link
              href={`/community/${project.slug}/`}
              className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors group"
            >
              Abrir proyecto
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">
            No se encontraron proyectos que coincidan con tu búsqueda.
          </p>
          <button
            onClick={() => {
              setSearchQuery('')
              setActiveCategory('todos')
            }}
            className="mt-3 text-sm text-gray-600 underline hover:text-gray-900"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}
