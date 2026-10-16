import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Tipo = 'ok' | 'error' | 'info';
interface Item { id: number; tipo: Tipo; texto: string }
interface ToastCtx { ok: (t: string) => void; error: (t: string) => void; info: (t: string) => void }

const Ctx = createContext<ToastCtx | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const quitar = (id: number) => setItems((l) => l.filter((i) => i.id !== id));
  const agregar = useCallback((tipo: Tipo, texto: string) => {
    const id = ++seq;
    setItems((l) => [...l, { id, tipo, texto }]);
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), tipo === 'error' ? 7000 : 4000);
  }, []);
  const api: ToastCtx = {
    ok: (t) => agregar('ok', t),
    error: (t) => agregar('error', t),
    info: (t) => agregar('info', t),
  };
  const estilo: Record<Tipo, string> = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  const Icono = { ok: CheckCircle2, error: AlertTriangle, info: Info };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed inset-x-3 bottom-3 z-[2000] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto" role="status" aria-live="polite">
        {items.map((i) => {
          const I = Icono[i.tipo];
          return (
            <div key={i.id} className={`flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${estilo[i.tipo]}`}>
              <I size={18} className="mt-0.5 shrink-0" />
              <span className="flex-1">{i.texto}</span>
              <button onClick={() => quitar(i.id)} aria-label="Cerrar"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast fuera de ToastProvider');
  return c;
}
