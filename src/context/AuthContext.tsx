import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Rol } from '../lib/types';

export interface DatosRegistro {
  nombres: string;
  dni: string;
  email: string;
  celular: string;
  cargo: string;
  password: string;
}

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  cargando: boolean;
  esStaff: boolean;
  esAdmin: boolean;
  tieneRol: (...roles: Rol[]) => boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  registrar: (d: DatosRegistro) => Promise<{ requiereConfirmacion: boolean }>;
  cerrarSesion: () => Promise<void>;
  recuperarPassword: (email: string) => Promise<void>;
  cambiarPassword: (password: string) => Promise<void>;
  recargarPerfil: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargandoSesion(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => {
      // No hacer llamadas a Supabase aquí dentro (evita bloqueos); solo guardar la sesión.
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;

  const cargarPerfil = useCallback(async () => {
    if (!uid) { setProfile(null); return; }
    setCargandoPerfil(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile((data as Profile) ?? null);
    setCargandoPerfil(false);
  }, [uid]);

  useEffect(() => { void cargarPerfil(); }, [cargarPerfil]);

  const value = useMemo<AuthCtx>(() => ({
    session,
    profile,
    cargando: cargandoSesion || cargandoPerfil,
    esStaff: profile?.rol === 'administrador' || profile?.rol === 'supervisor',
    esAdmin: profile?.rol === 'administrador',
    tieneRol: (...roles) => !!profile && roles.includes(profile.rol),
    iniciarSesion: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    registrar: async (d) => {
      const { data, error } = await supabase.auth.signUp({
        email: d.email,
        password: d.password,
        options: {
          data: { nombres: d.nombres, dni: d.dni, celular: d.celular, cargo: d.cargo },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
      // Supabase devuelve identities vacío si el correo ya existe (con confirmación activa)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('Ese correo ya está registrado.');
      }
      return { requiereConfirmacion: !data.session };
    },
    cerrarSesion: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
    recuperarPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/restablecer`,
      });
      if (error) throw error;
    },
    cambiarPassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    recargarPerfil: cargarPerfil,
  }), [session, profile, cargandoSesion, cargandoPerfil, cargarPerfil]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return c;
}
