'use client'

import { useState } from 'react'
import { ArrowRight, ShoppingCart, DollarSign, Heart, Shield, Sparkles, Zap, Users, Bot, Clock, ChevronRight, MessageCircle, Star, Send, Check, Loader2 } from 'lucide-react'

export default function HomePage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' })
  const [formSent, setFormSent] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email) return
    setFormLoading(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      setFormSent(true)
    } catch {}
    setFormLoading(false)
  }
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/avi-icon.svg" alt="AVI" className="w-8 h-8 rounded-lg" />
            <span className="text-xl font-bold text-indigo-700">AVI</span>
            <span className="text-lg font-semibold text-gray-800">Shopper</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#como-funciona" className="text-sm text-gray-500 hover:text-indigo-600">Como funciona</a>
            <a href="#supermercados" className="text-sm text-gray-500 hover:text-indigo-600">Supermercados</a>
            <a href="#familia" className="text-sm text-gray-500 hover:text-indigo-600">Para tu familia</a>
          </nav>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-gray-600 hover:text-indigo-600 font-medium hidden sm:block">Iniciar sesion</a>
            <a href="/registro" className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-full font-semibold hover:bg-indigo-700 transition-colors">
              Comenzar gratis
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/30">
        {/* Decorative background elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-40 h-40 bg-amber-200/15 rounded-full blur-2xl" />
        <div className="absolute top-10 right-20 w-3 h-3 bg-indigo-400 rounded-full opacity-40 anim-float" />
        <div className="absolute top-32 left-1/4 w-2 h-2 bg-teal-400 rounded-full opacity-30 anim-float" style={{animationDelay: '1s'}} />
        <div className="absolute bottom-20 left-20 w-4 h-4 bg-amber-400 rounded-full opacity-20 anim-float" style={{animationDelay: '2s'}} />
        <div className="absolute top-1/2 right-10 w-2.5 h-2.5 bg-rose-400 rounded-full opacity-25 anim-float" style={{animationDelay: '1.5s'}} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(circle, #4F46E5 1px, transparent 1px)', backgroundSize: '32px 32px'}} />
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="anim-1 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-6">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">Asistente de compras con IA</span>
              </div>
              <h1 className="anim-2 text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Tu compra del super,
                <span className="text-indigo-600"> resuelta.</span>
              </h1>
              <p className="anim-3 text-lg text-gray-500 mt-5 leading-relaxed max-w-lg">
                Dile a AVI que necesitas. El compara precios en 4 supermercados,
                arma tu carrito y te ahorra hasta un 45%.
              </p>
              <div className="anim-4 flex flex-col sm:flex-row gap-3 mt-8">
                <a href="/registro" className="bg-indigo-600 text-white px-7 py-3.5 rounded-full font-semibold text-base hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-xl transition-all">
                  Comenzar gratis
                  <ArrowRight className="h-5 w-5" />
                </a>
                <a href="/demo" className="bg-gray-100 text-gray-700 px-7 py-3.5 rounded-full font-medium text-base hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors">
                  <span className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <ArrowRight className="h-4 w-4 text-indigo-600" />
                  </span>
                  Ver demo
                </a>
              </div>
              <div className="flex items-center gap-4 mt-8">
                <div className="flex -space-x-2">
                  {['bg-indigo-400', 'bg-teal-400', 'bg-amber-400', 'bg-rose-400'].map((c, i) => (
                    <div key={i} className={`w-8 h-8 ${c} rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>
                      {['M', 'C', 'P', 'A'][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map((i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-xs text-gray-400">Familias ahorrando con AVI</p>
                </div>
              </div>
            </div>
            <div className="relative hidden md:block anim-3">
              <div className="bg-gradient-to-br from-indigo-100 to-violet-100 rounded-3xl p-8 relative anim-float">
                <div className="bg-white rounded-2xl shadow-xl p-5 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <img src="/avi-icon.svg" alt="" className="w-10 h-10 rounded-xl" />
                    <div>
                      <p className="font-bold text-gray-900 text-sm">AVI</p>
                      <p className="text-xs text-gray-400">Asistente de compras</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-gray-700 max-w-[80%]">
                      ¿Que necesitas hoy?
                    </div>
                    <div className="bg-indigo-600 rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white ml-auto max-w-[70%]">
                      Leche, pan y huevos
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-gray-700 max-w-[85%]">
                      Encontre los 3 en Lider por $4.280. ¿Armo el carrito?
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3 shadow-sm">
                    <p className="text-xs text-gray-400">Jumbo</p>
                    <p className="text-base font-bold text-gray-900">$5.120</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 shadow-sm border-2 border-indigo-500">
                    <p className="text-xs text-indigo-600 font-medium">Lider - Mejor</p>
                    <p className="text-base font-bold text-indigo-700">$4.280</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="py-20 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-indigo-600 font-semibold text-sm uppercase tracking-wider mb-2">Simple y rapido</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Compra en 3 pasos</h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto">Sin buscar producto por producto. AVI hace el trabajo por ti.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Bot, title: 'Dile a AVI que necesitas', desc: '"Necesito cosas para un asado para 8 personas" — AVI arma la lista completa.', color: 'bg-indigo-500' },
              { step: '02', icon: DollarSign, title: 'AVI compara precios', desc: 'Busca en Jumbo, Lider, Unimarc y Tottus. Te muestra el mas barato.', color: 'bg-teal-500' },
              { step: '03', icon: ShoppingCart, title: 'AVI arma tu carrito', desc: 'Agrega los productos al supermercado que elegiste. Tu solo pagas.', color: 'bg-amber-500' },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.step} className="relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-5xl font-black text-gray-100 absolute top-6 right-6">{s.step}</span>
                  <div className={`w-14 h-14 ${s.color} rounded-2xl flex items-center justify-center mb-5`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Supermercados */}
      <section id="supermercados" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-indigo-600 font-semibold text-sm uppercase tracking-wider mb-2">Precios reales</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">4 supermercados,<br/>1 mejor precio.</h2>
              <p className="text-gray-500 mt-4 leading-relaxed">
                AVI busca en tiempo real en los principales supermercados de Chile.
                Te muestra donde esta mas barato cada producto y cuanto ahorras.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { name: 'Jumbo', color: 'bg-green-500', desc: 'Cencosud — amplia variedad' },
                  { name: 'Lider', color: 'bg-blue-600', desc: 'Walmart — precios bajos' },
                  { name: 'Unimarc', color: 'bg-orange-500', desc: 'SMU — cerca de ti' },
                  { name: 'Tottus', color: 'bg-teal-600', desc: 'Falabella — ofertas diarias' },
                ].map((s) => (
                  <div key={s.name} className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center`}>
                      <span className="text-white font-bold text-sm">{s.name[0]}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{s.name}</p>
                      <p className="text-sm text-gray-400">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Ahorro promedio', value: '35%', sub: 'vs comprar sin comparar', color: 'bg-indigo-50 text-indigo-700' },
                { label: 'Productos', value: '100+', sub: 'en el diccionario de AVI', color: 'bg-teal-50 text-teal-700' },
                { label: 'Respuesta', value: '<3s', sub: 'comparacion instantanea', color: 'bg-amber-50 text-amber-700' },
                { label: 'Costo', value: '$0', sub: 'gratis para siempre', color: 'bg-rose-50 text-rose-700' },
              ].map((s) => (
                <div key={s.label} className={`${s.color} rounded-2xl p-6 text-center`}>
                  <p className="text-3xl font-black">{s.value}</p>
                  <p className="font-semibold text-sm mt-1">{s.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Para tu familia */}
      <section id="familia" className="py-20 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-indigo-600 font-semibold text-sm uppercase tracking-wider mb-2">Mas que precios</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">AVI cuida a tu familia</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Heart, title: 'Alertas de alergenos', desc: 'Si tu hijo es alergico al gluten, AVI te avisa antes de comprar.', color: 'text-rose-500' },
              { icon: Users, title: 'Listas compartidas', desc: 'Toda la familia agrega lo que necesita. AVI organiza todo.', color: 'text-purple-500' },
              { icon: Clock, title: 'Prediccion de reposicion', desc: '"La leche se acaba en 2 dias" — AVI aprende tus patrones.', color: 'text-indigo-500' },
              { icon: Sparkles, title: 'Eventos proactivos', desc: '"Fiestas Patrias en 14 dias. ¿Armo la lista del asado?"', color: 'text-amber-500' },
              { icon: Shield, title: 'Presupuesto familiar', desc: 'Controla cuanto gastas al mes. AVI te avisa si te pasas.', color: 'text-teal-500' },
              { icon: MessageCircle, title: 'AVI en WhatsApp', desc: 'Agrega a AVI al grupo familiar. Compra desde el chat.', color: 'text-green-500' },
            ].map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="bg-white rounded-2xl p-6 hover:shadow-md transition-shadow">
                  <Icon className={`h-8 w-8 ${f.color} mb-4`} />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Contact Form + CTA */}
      <section id="contacto" className="py-20 bg-indigo-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="text-center md:text-left">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Empieza a ahorrar hoy
              </h2>
              <p className="text-lg text-indigo-200 mb-6">
                Dejanos tus datos y te contactamos. O empieza ahora mismo.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="/registro" className="bg-white text-indigo-700 px-7 py-3.5 rounded-full font-semibold hover:bg-indigo-50 shadow-xl transition-all flex items-center justify-center gap-2">
                  Crear cuenta gratis <ArrowRight className="h-5 w-5" />
                </a>
                <a href="https://wa.me/56994893097?text=Hola%20AVI" target="_blank" className="border border-white/30 text-white px-7 py-3.5 rounded-full font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <MessageCircle className="h-5 w-5" /> WhatsApp
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              {formSent ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="h-7 w-7 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Gracias!</h3>
                  <p className="text-sm text-gray-500 mt-1">Te contactaremos pronto.</p>
                </div>
              ) : (
                <form onSubmit={submitForm}>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Contactanos</h3>
                  <div className="space-y-3">
                    <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Tu nombre" className="w-full px-4 py-3 bg-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all" />
                    <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="Email" className="w-full px-4 py-3 bg-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all" />
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="Telefono (opcional)" className="w-full px-4 py-3 bg-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all" />
                    <textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})}
                      placeholder="Mensaje (opcional)" rows={2} className="w-full px-4 py-3 bg-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all resize-none" />
                    <button type="submit" disabled={formLoading || !formData.name || !formData.email}
                      className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {formLoading ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src="/avi-icon.svg" alt="AVI" className="w-8 h-8 rounded-lg" />
              <span className="text-lg font-bold text-white">AVI Shopper</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <a href="/privacidad" className="hover:text-white">Privacidad</a>
              <a href="/eliminar-datos" className="hover:text-white">Eliminar datos</a>
              <a href="/demo" className="hover:text-white">Demo</a>
              <a href="/login" className="hover:text-white">Iniciar sesion</a>
            </div>
            <p className="text-sm text-gray-500">&copy; 2026 AVI Shopper</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
