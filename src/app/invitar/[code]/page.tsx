import { prisma } from '@/lib/prisma';
import { ShoppingCart, Users, Heart, DollarSign, ArrowRight } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function InvitePage({ params }: { params: { code: string } }) {
  const family = await prisma.family.findUnique({
    where: { inviteCode: params.code },
    include: { members: { select: { name: true, type: true } } },
  }).catch(() => null);

  if (!family) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex items-center justify-center px-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-gray-900">Invitacion no valida</h1>
          <p className="text-sm text-gray-500 mt-2">Este link de invitacion no existe o ya expiro.</p>
          <a href="/" className="avi-btn-primary mt-6 inline-block">Ir a AVI Shopper</a>
        </div>
      </div>
    );
  }

  const personCount = family.members.filter((m) => m.type === 'person').length;
  const petCount = family.members.filter((m) => m.type === 'pet').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 border border-white/20">
        <img src="/avi-icon.svg" alt="AVI" className="w-12 h-12" />
      </div>

      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
            <Users className="h-3.5 w-3.5" />
            Invitacion familiar
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{family.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Te invitan a unirte a su grupo familiar en AVI Shopper
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {personCount} persona{personCount !== 1 ? 's' : ''}{petCount > 0 ? ` y ${petCount} mascota${petCount !== 1 ? 's' : ''}` : ''}
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          {[
            { icon: ShoppingCart, text: 'Comparte listas de compras con tu familia' },
            { icon: DollarSign, text: 'Compara precios en 4 supermercados' },
            { icon: Heart, text: 'AVI cuida la nutricion de cada miembro' },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm text-gray-700">{b.text}</span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <a href={`/registro?invite=${params.code}`}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all">
            Crear cuenta y unirme
            <ArrowRight className="h-4 w-4" />
          </a>
          <a href={`/login?invite=${params.code}`}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-all">
            Ya tengo cuenta
          </a>
        </div>
      </div>

      <p className="text-xs text-blue-200 mt-6 text-center max-w-sm">
        AVI Shopper es un asistente de compras con IA que ayuda a tu familia a comprar mejor, mas barato y mas sano.
      </p>
    </div>
  );
}
