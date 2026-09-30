import { ArrowRight, ShoppingCart, Users, DollarSign, Brain, Heart, Shield, Sparkles } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="avi-header">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AVI</span>
            <span className="text-xl font-semibold text-gray-800">Shopper</span>
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">Beta</span>
          </div>
          <div className="flex items-center space-x-4">
            <a href="/demo" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">Demo</a>
            <a href="/login" className="text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium">Iniciar Sesion</a>
            <a href="/registro" className="avi-btn-primary text-sm !px-5 !py-2">Registrarse</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span className="text-sm text-blue-100">Asistente con IA para tu familia</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Compras Familiares
              <span className="block text-blue-200">Inteligentes</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 mt-6 max-w-2xl mx-auto leading-relaxed">
              AVI compara precios en 4 supermercados, cuida tu nutricion,
              predice que se va a acabar, y te ahorra hasta un 45%.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <a href="/registro" className="bg-white text-blue-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-50 flex items-center justify-center shadow-lg hover:shadow-xl transition-all">
                Comenzar Gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a href="/demo" className="border border-white/30 text-white px-8 py-3.5 rounded-xl font-medium hover:bg-white/10 backdrop-blur-sm transition-all">
                Ver Demo
              </a>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Todo lo que tu familia necesita</h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">AVI es como tener un asistente personal de compras que conoce a tu familia.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: DollarSign, title: 'Comparar Precios', desc: 'Busca lo mas barato en Jumbo, Lider, Santa Isabel y Unimarc en tiempo real', color: 'bg-emerald-500' },
              { icon: Users, title: 'Listas Familiares', desc: 'Comparte listas con toda la familia. Cada uno agrega lo que necesita', color: 'bg-purple-500' },
              { icon: Heart, title: 'Nutricion', desc: 'Te alerta de alergenos, ultra-procesados y sugiere alternativas saludables', color: 'bg-rose-500' },
              { icon: Brain, title: 'Prediccion', desc: 'Sabe cuando se va a acabar la leche y te avisa antes de que pase', color: 'bg-blue-500' },
            ].map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="avi-card p-6 group hover:translate-y-[-2px] transition-all">
                  <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center shadow-sm mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, value: '4', label: 'Supermercados comparados', sub: 'Jumbo · Lider · Santa Isabel · Unimarc' },
              { icon: DollarSign, value: '45%', label: 'Ahorro maximo', sub: 'Comprando en el lugar correcto' },
              { icon: Heart, value: '100%', label: 'Datos nutricionales', sub: 'NutriScore, NOVA, alergenos' },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="text-center">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-gray-100 mb-3">
                    <Icon className="h-7 w-7 text-blue-600" />
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{s.value}</p>
                  <p className="font-medium text-gray-900 mt-1">{s.label}</p>
                  <p className="text-sm text-gray-500">{s.sub}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl font-bold text-white mb-4">
            Empieza a ahorrar hoy
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Gratis. Sin tarjeta de credito. Solo dile a AVI que necesitas comprar.
          </p>
          <a href="/registro" className="inline-flex items-center bg-white text-blue-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all">
            Crear Cuenta Gratis
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p>&copy; 2026 AVI Shopper. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
