// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ShoppingCart, Check, X, AlertTriangle, ChevronLeft, Loader2, Shield, Store, ExternalLink } from 'lucide-react';

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
  storeSlug: string;
  status: string;
  subtotal: number;
  total: number;
  note: string;
  items: CartItem[];
  createdAt: string;
}

type FillStatus = 'idle' | 'filling' | 'filled' | 'partial' | 'no_connection' | 'no_worker' | 'needs_user_action' | 'failed';

const STORE_CART_URLS = {
  jumbo: 'https://www.jumbo.cl/checkout/#/cart',
  lider: 'https://www.lider.cl/supermercado/checkout',
  unimarc: 'https://www.unimarc.cl/cart',
  tottus: 'https://www.tottus.cl/tottus-cl/cart',
};

export default function CarroPage() {
  const params = useParams();
  const cartId = params.cartId as string;
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fillStatus, setFillStatus] = useState<FillStatus>('idle');
  const [fillMessage, setFillMessage] = useState<string | null>(null);
  const [fillResult, setFillResult] = useState<any>(null);

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch(`/api/carts/${cartId}`);
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

  const handleFill = async () => {
    setFillStatus('filling');
    setFillMessage('AVI está armando tu carro...');

    try {
      const res = await fetch(`/api/carts/${cartId}/fill`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        const code = data.error?.code;
        if (code === 'NO_STORE_CONNECTION') {
          setFillStatus('no_connection');
          setFillMessage(data.error?.message || 'No hay cuenta de tienda conectada');
        } else if (code === 'WORKER_ERROR') {
          if (data.error?.message?.includes('no está configurado')) {
            setFillStatus('no_worker');
            setFillMessage('El worker de tiendas no está configurado. Contacta al administrador.');
          } else if (data.error?.message?.includes('needs_user_action')) {
            setFillStatus('needs_user_action');
            setFillMessage('La tienda requiere verificación (captcha o 2FA). Complétala y reintenta.');
          } else {
            setFillStatus('failed');
            setFillMessage(data.error?.message || 'Error al armar el carro');
          }
        } else {
          setFillStatus('failed');
          setFillMessage(data.error?.message || 'Error al armar el carro');
        }
        return;
      }

      setFillResult(data.data);
      const result = data.data;
      if (result?.status === 'filled') {
        setFillStatus('filled');
        setFillMessage('¡Carro armado! Revisa y paga en la tienda.');
      } else if (result?.status === 'partial') {
        setFillStatus('partial');
        setFillMessage(`Carro parcial: ${result.itemsAdded} de ${result.itemsRequested} productos agregados.`);
      } else {
        setFillStatus('filled');
        setFillMessage('Carro procesado.');
      }
    } catch {
      setFillStatus('failed');
      setFillMessage('Error de conexión con el worker');
    }
  };

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
          <a href="/dashboard" className="mt-3 inline-block text-sm text-indigo-600 underline">Ir al inicio</a>
        </div>
      </div>
    );
  }

  const statusConfig = {
    proposed: { label: 'Propuesto', color: 'text-amber-600' },
    approved: { label: 'Aprobado', color: 'text-emerald-600' },
    filled: { label: 'Armado en tienda', color: 'text-indigo-600' },
    dismissed: { label: 'Descartado', color: 'text-slate-500' },
  };
  const status = statusConfig[cart.status] || statusConfig.proposed;
  const storeCartUrl = STORE_CART_URLS[cart.storeSlug] || STORE_CART_URLS.jumbo;

  return (
    <div className="min-h-screen bg-slate-50">
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
        {cart.note && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{cart.note}</span>
          </div>
        )}

        {cart.items.map((item) => (
          <div key={item.id} className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">{item.name}</div>
                <div className="text-sm text-slate-500">{item.quantity} {item.unit} — {formatClp(item.payable)}</div>
              </div>
              {item.approved === true && <Check className="h-5 w-5 text-emerald-500" />}
              {item.approved === false && <X className="h-5 w-5 text-red-500" />}
              {item.approved === null && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Pendiente</span>}
            </div>
          </div>
        ))}

        <div className="rounded-xl bg-white border border-slate-200 p-3 flex items-center justify-between">
          <span className="font-medium text-slate-700">Subtotal estimado</span>
          <span className="font-semibold text-slate-900">{formatClp(cart.subtotal)}</span>
        </div>

        {/* Proposed → Revisar y aprobar */}
        {cart.status === 'proposed' && (
          <a href={`/carro/${cartId}/sustitutos`}
            className="block rounded-xl bg-indigo-600 text-white text-center py-3 font-medium hover:bg-indigo-700">
            Revisar y aprobar
          </a>
        )}

        {/* Approved → Armar en tienda */}
        {cart.status === 'approved' && fillStatus === 'idle' && (
          <button onClick={handleFill}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
            <Store className="h-5 w-5" />
            AVI arma el carrito en {cart.storeName}
          </button>
        )}

        {/* Filling */}
        {fillStatus === 'filling' && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-sm text-indigo-800 font-medium">{fillMessage}</p>
            <p className="text-xs text-indigo-600 mt-1">Esto puede tardar unos minutos...</p>
          </div>
        )}

        {/* No connection */}
        {fillStatus === 'no_connection' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
            <p className="text-sm text-amber-800 font-medium">{fillMessage}</p>
            <a href="/ajustes/tiendas"
              className="block rounded-xl bg-amber-600 text-white text-center py-2 text-sm font-medium hover:bg-amber-700">
              Conectar cuenta de {cart.storeName}
            </a>
          </div>
        )}

        {/* No worker */}
        {fillStatus === 'no_worker' && (
          <div className="rounded-xl bg-slate-100 border border-slate-200 p-4">
            <p className="text-sm text-slate-700">{fillMessage}</p>
          </div>
        )}

        {/* Needs user action (captcha/2FA) */}
        {fillStatus === 'needs_user_action' && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-2">
            <p className="text-sm text-red-800 font-medium">{fillMessage}</p>
            <button onClick={() => { setFillStatus('idle'); }}
              className="rounded-xl border border-red-200 text-red-700 px-4 py-2 text-sm">
              Reintentar
            </button>
          </div>
        )}

        {/* Failed */}
        {fillStatus === 'failed' && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-2">
            <p className="text-sm text-red-800">{fillMessage}</p>
            <button onClick={() => { setFillStatus('idle'); }}
              className="rounded-xl border border-red-200 text-red-700 px-4 py-2 text-sm">
              Reintentar
            </button>
          </div>
        )}

        {/* Filled / Partial → link to store cart */}
        {(fillStatus === 'filled' || fillStatus === 'partial') && (
          <div className="space-y-3">
            <div className={`rounded-xl p-4 ${fillStatus === 'filled' ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`text-sm font-medium ${fillStatus === 'filled' ? 'text-emerald-800' : 'text-amber-800'}`}>{fillMessage}</p>
              {fillResult?.storeCartTotal > 0 && (
                <p className="text-sm mt-1">Total en tienda: <strong>{formatClp(fillResult.storeCartTotal)}</strong></p>
              )}
            </div>

            {fillStatus === 'partial' && fillResult?.substitutesPending?.length > 0 && (
              <a href={`/carro/${cartId}/sustitutos`}
                className="block rounded-xl border border-amber-200 text-amber-700 text-center py-2 text-sm font-medium">
                Ver sustitutos pendientes ({fillResult.substitutesPending.length})
              </a>
            )}

            <a href={storeCartUrl} target="_blank" rel="noopener noreferrer"
              className="block rounded-xl bg-indigo-600 text-white text-center py-3 font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Revisar y pagar en {cart.storeName}
            </a>
          </div>
        )}

        <div className="text-center text-xs text-slate-400">
          Propuesto el {new Date(cart.createdAt).toLocaleDateString('es-CL', {
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pt-2">
          <Shield className="h-3.5 w-3.5" />
          AVI nunca paga ni hace checkout. Tú decides.
        </div>
      </div>
    </div>
  );
}
