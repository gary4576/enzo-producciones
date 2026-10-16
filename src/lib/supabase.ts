import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && anon && !url.includes('TU-PROYECTO'));

// Solo se usa la clave pública "anon". La seguridad real la dan las políticas RLS.
export const supabase = createClient(
  supabaseConfigurado ? url! : 'https://placeholder.supabase.co',
  supabaseConfigurado ? anon! : 'placeholder-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
