'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Check, ChevronLeft, Loader2, RefreshCw, Shield, X } from 'lucide-react';

type Approval = 'pending' | 'approved' | 'rejected';

interface AllergenWarning {
  allergen: string;
  kind: 'contains' | 'traces';
  message: string;
}

interface Substitute {
  itemId: string;
  name: string;
  reason: string;
  approval: Approval;
  candidate: { name: string; brand: string | null; price: number; available: boolean; url: string | null } | null;
  original: { quantity: number; unit: string; payable: number } | null;
  isLocked: boolean;
  allergens: { warnings: AllergenWarning[]; notice: string | null };
}

interface SubstitutesData {
  cartId: string;
  fillId: string | null;
  store: string | null;
  isApprover: boolean;
  substitutes: Substitute[];
}

const REASONS: Record<string, string> = {
  out_of_stock: 'Sin stock',
  not_found: 'No encontrado en la tienda',
  needs_user_action: 'La tienda pidió verificación',
  error: 'No se pudo agregar',
};

const clp = (value: number) => `$${value.toLocaleString('es-CL')}`;

type Decision = { action: 'approve'; itemId: string; updateLockedProduct?: boolean } | { action: 'reject'; itemId: string } | { action: 'approve_all' };

export default function SustitutosPage() {
  const params = useParams<{ cartId: string }>();
  const cartId = params?.cartId ?? '';
  const [data, setData] = useState<SubstitutesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [lockedPrompt, setLockedPrompt] = useState<string | null>(null);

  const fetchSubstitutes = useCallback(async () => {
    if (!cartId) return;
    try {
      const res = await fetch(`/api/carts/${encodeURIComponent(cartId)}/substitutes`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error?.message ?? 'No pude cargar los sustitutos');
    } catch {
      setError('No pude cargar los sustitutos');
    } finally {
      setLoading(false);
    }
  }, [cartId]);

  useEffect(() => {
    void fetchSubstitutes();
  }, [fetchSubstitutes]);

  const decide = async (decision: Decision) => {
    setWorking(decision.action === 'approve_all' ? '*' : decision.itemId);
    setError(null);
    try {
      const res = await fetch(`/api/carts/${encodeURIComponent(cartId)}/substitutes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision),
      });
      const json = await res.json();
      if (json.success) setData((prev) => (prev ? { ...prev, substitutes: json.data.substitutes } : prev));
      else {
        setError(json.error?.message ?? 'No pude guardar la decisión');
        if (res.status === 409) void fetchSubstitutes();
      }
    } catch {
      setError('No pude guardar la decisión');
    } finally {
      setWorking(null);
      setLockedPrompt(null);
    }
  };

  const header = (subtitle: string | null, approveAll: boolean) => (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/reposicion" className="p-2 -ml-2 rounded-xl hover:bg-slate-100" aria-label="Volver">
            <ChevronLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Sustitutos</h1>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {approveAll && (
          <button
            onClick={() => void decide({ action: 'approve_all' })}
            disabled={working !== null}
            className="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
          >
            {working === '*' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprobar todos
          </button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const subs = data?.substitutes ?? [];
  const pending = subs.filter((s) => s.approval === 'pending');
  const decided = subs.filter((s) => s.approval !== 'pending');
  const canDecide = Boolean(data?.isApprover);

  if (subs.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        {header(null, false)}
        <div className="max-w-lg mx-auto px-4 py-12 text-center text-slate-500">
          {error ? (
            <p className="text-red-700">{error}</p>
          ) : (
            <>
              <Check className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">¡Todo listo!</p>
              <p className="text-sm mt-1">No hay sustitutos por decidir.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {header(pending.length > 0 ? `${pending.length} por decidir` : 'Todos decididos', canDecide && pending.filter((s) => s.candidate).length > 1)}

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {!canDecide && pending.length > 0 && (
          <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">Solo quien aprueba el carro de la familia puede decidir los sustitutos.</div>
        )}

        {pending.map((sub) => {
          const isWorking = working === sub.itemId;
          return (
            <div key={sub.itemId} className="rounded-2xl bg-white border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-50 p-2">
                  <RefreshCw className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 text-sm">
                  <div className="text-slate-500 line-through">{sub.name}{sub.original ? ` · ${clp(sub.original.payable)}` : ''}</div>
                  <div className="text-xs text-slate-400">{REASONS[sub.reason] ?? sub.reason}{sub.isLocked ? ' · producto fijo' : ''}</div>
                  {sub.candidate ? (
                    <div className="mt-1 font-medium text-slate-900">
                      {sub.candidate.name}{sub.candidate.brand ? ` (${sub.candidate.brand})` : ''} · {clp(sub.candidate.price)}
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-600">La tienda no tiene un reemplazo sugerido.</div>
                  )}
                </div>
              </div>

              {sub.allergens.warnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {sub.allergens.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span>{w.message}</span>
                    </div>
                  ))}
                </div>
              )}
              {sub.candidate && sub.allergens.warnings.length === 0 && sub.allergens.notice && (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Alérgenos no verificados para este producto: revisa la etiqueta.</div>
              )}

              {canDecide &&
                (lockedPrompt === sub.itemId ? (
                  <div className="mt-3 rounded-xl bg-blue-50 p-3">
                    <p className="text-sm text-blue-800 font-medium">¿Usar este de ahora en adelante?</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => void decide({ action: 'approve', itemId: sub.itemId, updateLockedProduct: true })}
                        disabled={isWorking}
                        className="rounded-xl bg-blue-600 text-white px-3 py-1.5 text-sm"
                      >
                        {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, de ahora en adelante'}
                      </button>
                      <button
                        onClick={() => void decide({ action: 'approve', itemId: sub.itemId, updateLockedProduct: false })}
                        disabled={isWorking}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
                      >
                        Solo esta vez
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    {sub.candidate && (
                      <button
                        onClick={() => (sub.isLocked ? setLockedPrompt(sub.itemId) : void decide({ action: 'approve', itemId: sub.itemId }))}
                        disabled={working !== null}
                        className="flex-1 rounded-xl bg-emerald-600 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Aprobar
                      </button>
                    )}
                    <button
                      onClick={() => void decide({ action: 'reject', itemId: sub.itemId })}
                      disabled={working !== null}
                      className="rounded-xl border border-slate-200 text-slate-600 px-4 py-2.5 text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Rechazar
                    </button>
                  </div>
                ))}
            </div>
          );
        })}

        {decided.length > 0 && (
          <div className="pt-2">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Ya decididos</div>
            {decided.map((sub) => (
              <div
                key={sub.itemId}
                className={`rounded-xl border p-3 mb-2 ${sub.approval === 'approved' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
              >
                <div className="flex items-center gap-2 text-sm">
                  {sub.approval === 'approved' ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-red-600" />}
                  <span className={sub.approval === 'approved' ? 'text-emerald-800' : 'text-red-800'}>
                    {sub.approval === 'approved' ? `${sub.candidate?.name ?? sub.name} — aprobado` : `${sub.name} — rechazado`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-400 pt-4 justify-center">
          <Shield className="h-3.5 w-3.5" />
          AVI nunca paga ni hace el pedido. Tú decides.
        </div>
      </div>
    </div>
  );
}
