import { useEffect, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X, Loader2, Inbox } from 'lucide-react';

export function Spinner({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500" role="status">
      <Loader2 className="animate-spin" size={18} /> {texto}
    </div>
  );
}

export function Vacio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-slate-500">
      <Inbox size={28} className="text-slate-300" />
      <p>{texto}</p>
      {children}
    </div>
  );
}

export function Encabezado({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

type Color = 'verde' | 'ambar' | 'rojo' | 'azul' | 'gris' | 'celeste';
const colores: Record<Color, string> = {
  verde: 'bg-emerald-100 text-emerald-800',
  ambar: 'bg-amber-100 text-amber-800',
  rojo: 'bg-red-100 text-red-700',
  azul: 'bg-blue-100 text-blue-800',
  gris: 'bg-slate-100 text-slate-600',
  celeste: 'bg-sky-100 text-sky-800',
};
export function Badge({ color = 'gris', children }: { color?: Color; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${colores[color]}`}>{children}</span>;
}

export function StatCard({ icono, color, etiqueta, valor, detalle }: {
  icono: ReactNode; color: string; etiqueta: string; valor: ReactNode; detalle?: string;
}) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${color}`}>{icono}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{etiqueta}</p>
        <p className="text-2xl font-bold text-navy-900">{valor}</p>
        {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
      </div>
    </div>
  );
}

interface CampoProps { label: string; error?: string; ayuda?: string }

export function Campo({ label, error, ayuda, className = '', ...p }: CampoProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input className={`field ${error ? 'border-red-400' : ''} ${className}`} aria-invalid={!!error} {...p} />
      {ayuda && !error && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Seleccion({ label, error, children, className = '', ...p }: CampoProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select className={`field ${error ? 'border-red-400' : ''} ${className}`} {...p}>{children}</select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function AreaTexto({ label, error, ...p }: CampoProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea rows={3} className={`field ${error ? 'border-red-400' : ''}`} {...p} />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Modal({ abierto, titulo, onCerrar, children, ancho = 'max-w-2xl' }: {
  abierto: boolean; titulo: string; onCerrar: () => void; children: ReactNode; ancho?: string;
}) {
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-navy-950/60 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`flex max-h-[92vh] w-full ${ancho} flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-navy-900">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Alerta({ tipo = 'info', children }: { tipo?: 'info' | 'error' | 'aviso' | 'ok'; children: ReactNode }) {
  const e = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    aviso: 'border-amber-200 bg-amber-50 text-amber-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[tipo];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${e}`} role="alert">{children}</div>;
}
