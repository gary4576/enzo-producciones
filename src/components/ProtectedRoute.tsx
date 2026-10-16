import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';
import type { Rol } from '../lib/types';
import { ShieldAlert } from 'lucide-react';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Rol[] }) {
  const { session, profile, cargando, cerrarSesion } = useAuth();
  const loc = useLocation();

  if (cargando) return <div className="min-h-screen bg-slate-50"><Spinner /></div>;
  if (!session) return <Navigate to="/login" replace state={{ desde: loc.pathname }} />;

  if (!profile) {
    return (
      <Aviso titulo="No se encontró tu perfil" texto="Tu cuenta existe pero no tiene perfil en el sistema. Contacta al administrador.">
        <button className="btn-secondary" onClick={cerrarSesion}>Cerrar sesión</button>
      </Aviso>
    );
  }
  if (!profile.activo) {
    return (
      <Aviso titulo="Cuenta desactivada" texto="Un administrador desactivó tu acceso. Comunícate con la empresa.">
        <button className="btn-secondary" onClick={cerrarSesion}>Cerrar sesión</button>
      </Aviso>
    );
  }
  if (roles && !roles.includes(profile.rol)) {
    return <Navigate to="/app" replace state={{ denegado: true }} />;
  }
  return <>{children}</>;
}

function Aviso({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 text-amber-500" size={36} />
        <h1 className="text-xl font-bold text-navy-900">{titulo}</h1>
        <p className="mt-2 text-sm text-slate-600">{texto}</p>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
