import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export function AuthShell({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo?: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-cielo/20 blur-3xl" />
        <Link to="/" className="relative"><Logo className="h-16 w-72" /></Link>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">La puntualidad también es parte del espectáculo</h2>
          <p className="mt-3 max-w-md text-slate-300">Registra tu asistencia con ubicación, consulta tus eventos y sigue el avance del montaje de equipos.</p>
        </div>
        <p className="relative text-sm italic text-cielo">¡Juntos hacemos que todo funcione!</p>
      </div>
      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 block lg:hidden"><Logo claro={false} className="h-14 w-56" /></Link>
          <h1 className="text-2xl font-bold text-navy-900">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
          <div className="mt-6">{children}</div>
          {pie && <div className="mt-6 text-center text-sm text-slate-600">{pie}</div>}
        </div>
      </div>
    </div>
  );
}
