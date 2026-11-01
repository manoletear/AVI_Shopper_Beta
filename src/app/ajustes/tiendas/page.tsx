'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { AlertTriangle, ChevronLeft, Loader2, ShoppingCart, Trash2, Wifi, WifiOff } from 'lucide-react';

type Status = 'disconnected' | 'active' | 'expired' | 'needs_user_action' | 'pending';

interface StoreRow {
  slug: string;
  name: string;
  status: Status;
  lastVerifiedAt: string | null;
  connectedAt: string | null;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: ComponentType<{ className?: string }> }> = {
  disconnected: { label: 'Sin conectar', color: 'text-slate-400', bg: 'bg-slate-50', icon: WifiOff },
  active: { label: 'Activa', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Wifi },
  expired: { label: 'Expirada', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle },
  needs_user_action: { label: 'Requiere acción', color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle },
  pending: { label: 'Conectando…', color: 'text-blue-600', bg: 'bg-blue-50', icon: Loader2 },
};

function asStatus(value: string): Status {
  return value in STATUS_CONFIG ? (value as Status) : 'disconnected';
}

export default function TiendasPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSlug, setActionSlug] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch('/api/tiendas', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setStores(json.data.stores.map((s: StoreRow) => ({ ...s, status: asStatus(s.status) })));
        setCanManage(Boolean(json.data.canManage));
        setError(null);
      } else {
        setError(json.error?.message ?? 'No pude cargar las tiendas');
      }
    } catch {
      setError('No pude cargar las tiendas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStores();
  }, [fetchStores]);

  // Mientras haya una conexión pendiente, revisa cada 5 s.
  useEffect(() => {
    if (!stores.some((s) => s.status === 'pending')) return;
    const interval = setInterval(() => void fetchStores(), 5000);
    return () => clearInterval(interval);
  }, [stores, fetchStores]);

  const handleConnect = async (slug: string) => {
    setActionSlug(slug);
    try {
      const res = await fetch('/api/tiendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeSlug: slug }),
      });
      const json = await res.json();
      if (json.success) setStores((prev) => prev.map((s) => (s.slug === slug ? { ...s, status: 'pending' } : s)));
      else setError(json.error?.message ?? 'No pude conectar');
    } catch {
      setError('No pude conectar');
    } finally {
      setActionSlug(null);
    }
  };

  const handleDisconnect = async (slug: string) => {
    setActionSlug(slug);
    try {
      const res = await fetch(`/api/tiendas/${slug}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setStores((prev) => prev.map((s) => (s.slug === slug ? { ...s, status: 'disconnected', lastVerifiedAt: null } : s)));
      } else {
        setError(json.error?.message ?? 'No pude desconectar');
      }
    } catch {
      setError('No pude desconectar');
    } finally {
      setActionSlug(null);
      setConfirmDisconnect(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/configuracion" className="p-2 -ml-2 rounded-xl hover:bg-slate-100" aria-label="Volver">
            <ChevronLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Mis supermercados</h1>
            <p className="text-sm text-slate-500">Conecta tu cuenta para que AVI llene el carro</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {stores.map((store) => {
          const config = STATUS_CONFIG[store.status];
          const StatusIcon = config.icon;
          const isWorking = actionSlug === store.slug;
          return (
            <div key={store.slug} className="rounded-2xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${config.bg}`}>
                    <ShoppingCart className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{store.name}</div>
                    <div className={`text-sm flex items-center gap-1 ${config.color}`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${store.status === 'pending' ? 'animate-spin' : ''}`} />
                      {config.label}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div>
                    {store.status === 'disconnected' || store.status === 'expired' || store.status === 'needs_user_action' ? (
                      <button
                        onClick={() => void handleConnect(store.slug)}
                        disabled={isWorking}
                        className={`rounded-xl text-white px-4 py-2 text-sm font-medium disabled:opacity-50 ${store.status === 'needs_user_action' ? 'bg-amber-600' : 'bg-slate-900'}`}
                      >
                        {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : store.status === 'needs_user_action' ? 'Reintentar' : 'Conectar'}
                      </button>
                    ) : store.status === 'active' ? (
                      confirmDisconnect === store.slug ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void handleDisconnect(store.slug)}
                            disabled={isWorking}
                            className="rounded-xl bg-red-600 text-white px-3 py-2 text-sm"
                          >
                            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, desconectar'}
                          </button>
                          <button onClick={() => setConfirmDisconnect(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDisconnect(store.slug)}
                          className="rounded-xl border border-slate-200 text-slate-600 px-3 py-2 text-sm flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Desconectar
                        </button>
                      )
                    ) : (
                      <span className="text-sm text-blue-600">Esperando…</span>
                    )}
                  </div>
                )}
              </div>

              {store.status === 'pending' && (
                <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                  Abre sesión en el worker de tu PC para completar la conexión. AVI nunca te pide ni guarda tu contraseña aquí.
                </div>
              )}
              {store.status === 'needs_user_action' && (
                <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  La tienda pidió verificación (captcha o 2FA). Complétala en tu PC y reintenta.
                </div>
              )}
              {store.lastVerifiedAt && store.status === 'active' && (
                <div className="mt-2 text-xs text-slate-400">
                  Última verificación: {new Date(store.lastVerifiedAt).toLocaleDateString('es-CL')}
                </div>
              )}
            </div>
          );
        })}

        <div className="text-center text-xs text-slate-400 pt-4">
          AVI no guarda contraseñas: solo una sesión cifrada para llenar tu carro. Nunca paga ni hace el pedido.
        </div>
      </div>
    </div>
  );
}
