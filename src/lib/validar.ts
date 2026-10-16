export const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const reDni = /^\d{8}$/;
export const reCelular = /^9\d{8}$/;

export type Errores<T> = Partial<Record<keyof T, string>>;

export function mensajeError(e: unknown): string {
  const m =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
      ? String((e as { message: unknown }).message)
      : String(e);
  if (/profiles_dni_key/i.test(m)) return 'Ese DNI ya está registrado.';
  if (/duplicate key|attendance_unico_por_dia/i.test(m)) return 'Ya existe un registro para ese trabajador en esa fecha.';
  if (/User already registered/i.test(m)) return 'Ese correo ya está registrado.';
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Debes confirmar tu correo antes de iniciar sesión.';
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para realizar esta acción.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión con el servidor. Revisa tu internet y la configuración de Supabase.';
  return m;
}
