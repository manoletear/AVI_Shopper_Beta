import Link from 'next/link'
import { ArrowLeft, Tag, Clock, FolderOpen } from 'lucide-react'
import { PROJECTS } from '@/data/projects'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return PROJECTS.map((project) => ({
    slug: project.slug,
  }))
}

export default function ProjectPage({ params }: { params: { slug: string } }) {
  const project = PROJECTS.find((p) => p.slug === params.slug)

  if (!project) {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Back link */}
      <Link
        href="/community/proyectos-activos/"
        className="inline-flex items-center text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Volver a proyectos
      </Link>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
          <Clock className="h-3 w-3" />
          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
          <FolderOpen className="h-3 w-3" />
          {project.category.charAt(0).toUpperCase() + project.category.slice(1)}
        </span>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        {project.title}
      </h1>

      {/* Description */}
      <p className="text-gray-500 text-base mb-6 leading-relaxed">
        {project.description}
      </p>

      {/* Tags */}
      <div className="flex items-start gap-2 mb-8">
        <Tag className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0" />
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Content placeholder */}
      <div className="border border-gray-200 rounded-lg p-8 bg-gray-50">
        <p className="text-sm text-gray-400 text-center">
          Contenido del proyecto disponible para miembros de la comunidad.
        </p>
      </div>
    </div>
  )
}
