import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, CalendarCheck, CalendarDays, Users, BarChart3, Settings, UserCircle, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { ROLES } from '../lib/types';
import { useToast } from './Toast';
import { useEffect } from 'react';

export function Layout() {
  const { profile, esStaff, esAdmin, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();

  useEffect(() => {
    setAbierto(false);
    if ((loc.state as { denegado?: boolean } | null)?.denegado) toast.error('No tienes permiso para entrar a esa sección.');
  }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = [
    { to: '/app', etiqueta: 'Inicio', icono: Home, fin: true, ver: true },
    { to: '/app/asistencia', etiqueta: 'Asistencia', icono: CalendarCheck, ver: true },
    { to: '/app/eventos', etiqueta: 'Eventos', icono: CalendarDays, ver: true },
    { to: '/app/trabajadores', etiqueta: 'Trabajadores', icono: Users, ver: esStaff },
    { to: '/app/reportes', etiqueta: 'Reportes', icono: BarChart3, ver: esStaff },
    { to: '/app/perfil', etiqueta: 'Mi perfil', icono: UserCircle, ver: true },
    { to: '/app/configuracion', etiqueta: 'Configuración', icono: Settings, ver: esAdmin },
  ].filter((i) => i.ver);

  const salir = async () => { await cerrarSesion(); nav('/login', { replace: true }); };

  const Menu_ = (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Menú principal">
      {items.map(({ to, etiqueta, icono: I, fin }) => (
        <NavLink key={to} to={to} end={fin}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-brand/90 text-white shadow' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
          <I size={19} /> {etiqueta}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 py-6 lg:flex">
        <NavLink to="/" className="mb-8 block px-5"><Logo className="h-14 w-full" /></NavLink>
        {Menu_}
        <p className="px-6 pt-6 text-center text-[11px] font-semibold leading-snug text-slate-400">GRANDES EVENTOS<br />TAMBIÉN SE HACEN<br />CON GRANDES EQUIPOS</p>
      </aside>

      {/* Menú móvil */}
      {abierto && (
        <div className="fixed inset-0 z-[900] lg:hidden" onClick={() => setAbierto(false)}>
          <div className="absolute inset-0 bg-navy-950/60" />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-navy-900 py-5" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-3 text-slate-300" onClick={() => setAbierto(false)} aria-label="Cerrar menú"><X /></button>
            <div className="mb-6 px-5"><Logo className="h-12 w-52" /></div>
            {Menu_}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-8">
          <button className="rounded p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setAbierto(true)} aria-label="Abrir menú"><Menu /></button>
          <div className="lg:hidden"><Logo claro={false} className="h-9 w-32" /></div>
          <div className="relative ml-auto">
            <button className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-slate-100" onClick={() => setMenuUsuario((v) => !v)} aria-haspopup="menu" aria-expanded={menuUsuario}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">{(profile?.nombres ?? profile?.nombres ?? 'U').charAt(0).toUpperCase()}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold leading-tight text-navy-900">{profile?.nombres ?? profile?.nombres ?? 'Usuario'}</span>
                <span className="block text-xs text-slate-500">{profile ? ROLES[profile.rol] : ''} · {profile?.cargo}</span>
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {menuUsuario && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="menu" onMouseLeave={() => setMenuUsuario(false)}>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50" onClick={() => { setMenuUsuario(false); nav('/app/perfil'); }}><UserCircle size={16} /> Mi perfil</button>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50" onClick={salir}><LogOut size={16} /> Cerrar sesión</button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8"><Outlet /></main>
        <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 sm:px-8">
          <strong className="text-navy-900">ENZO PRODUCCIONES LED &amp; EVENTOS - CAÑETE S.A.C.</strong>
          <span className="ml-2 hidden sm:inline">Producción audiovisual | Pantallas LED | Iluminación | Servicios técnicos</span>
        </footer>
      </div>
    </div>
  );
}
