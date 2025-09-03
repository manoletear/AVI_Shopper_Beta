import { ArrowRight, ShoppingCart, Users, DollarSign, Brain } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">AVI</span>
            <span className="text-xl font-semibold">Shopper</span>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Beta</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Compras Familiares
              <span className="text-blue-600 block">Inteligentes</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Orquesta tus compras con IA. Compara precios automáticamente, 
              gestiona listas familiares y ahorra tiempo y dinero.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center">
                Crear Lista Gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <button className="border border-gray-300 px-8 py-3 rounded-lg font-medium hover:bg-gray-50">
                Ver Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">Características Principales</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <Users className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Listas Familiares</h3>
              <p className="text-gray-600">Comparte y sincroniza listas con toda la familia en tiempo real</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <DollarSign className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Comparar Precios</h3>
              <p className="text-gray-600">Encuentra automáticamente los mejores precios en supermercados</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <Brain className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">IA Inteligente</h3>
              <p className="text-gray-600">Sustituciones y recomendaciones basadas en tus preferencias</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <ShoppingCart className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">División Automática</h3>
              <p className="text-gray-600">Separa tu carrito por tiendas para maximizar ahorros</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Únete a la revolución de las compras inteligentes
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Miles de familias ya ahorran tiempo y dinero con AVI Shopper
          </p>
          <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-gray-100">
            Comenzar Gratis Ahora
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2025 AVI Shopper. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
