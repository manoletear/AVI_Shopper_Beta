// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ShoppingCart, Check, X, AlertTriangle, ChevronLeft, Loader2, Shield } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  payable: number;
  approved: boolean | null;
}

interface Cart {
  id: string;
  storeName: string;
  status: string;
  subtotal: number;
  total: number;
  note: string;
  items: CartItem[];
  createdAt: string;
}

export default function CarroPage() {
  const params = useParams();
  const cartId = params.cartId as string;
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch(`/api/carts/proposed/${cartId}/approve`);
      if (!res.ok) {
        setError('No se pudo cargar el carro');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCart(data.data);
      } else {
        setError(data.error?.message || 'Error');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [cartId]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const formatClp = (amount: number) =>
    amount > 0 ? `$${amount.toLocaleString('es-CL')}` : 'Sin precio';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !cart) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700">{error || 'Carro no encontrado'}</p>
          <a href="/dashboard" className="mt-3 inline-block text-sm text-indigo-600 underline">
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  const statusConfig = {
    proposed: { label: 'Propuesto', color: 'text-amber-600', bg: 'bg-amber-50' },
    approved: { label: 'Aprobado', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    dismissed: { label: 'Descartado', color: 'text-slate-500', bg: 'bg-slate-100' },
  };
  const status = statusConfig[cart.status] || statusConfig.proposed;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Carro en {cart.storeName}</h1>
            <div className={`text-sm ${status.color}`}>{status.label}</div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* Note */}
        {cart.note && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{cart.note}</span>
          </div>
        )}

        {/* Items */}
        {cart.items.map((item) => (
          <div key={item.id} className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">{item.name}</div>
                <div className="text-sm text-slate-500">
                  {item.quantity} {item.unit} — {formatClp(item.payable)}
                </div>
              </div>
              {item.approved === true && <Check className="h-5 w-5 text-emerald-500" />}
              {item.approved === false && <X className="h-5 w-5 text-red-500" />}
              {item.approved === null && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Pendiente</span>
              )}
            </div>
          </div>
        ))}

        {/* Total */}
        <div className="rounded-xl bg-white border border-slate-200 p-3 flex items-center justify-between">
          <span className="font-medium text-slate-700">Subtotal estimado</span>
          <span className="font-semibold text-slate-900">{formatClp(cart.subtotal)}</span>
        </div>

        {/* Sustitutos link */}
        <a
          href={`/carro/${cartId}/sustitutos`}
          className="block rounded-xl bg-indigo-600 text-white text-center py-3 font-medium hover:bg-indigo-700"
        >
          Revisar sustitutos y aprobar
        </a>

        {/* Date */}
        <div className="text-center text-xs text-slate-400">
          Propuesto el {new Date(cart.createdAt).toLocaleDateString('es-CL', {
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pt-2">
          <Shield className="h-3.5 w-3.5" />
          AVI nunca paga ni hace checkout. Tú decides.
        </div>
      </div>
    </div>
  );
}
