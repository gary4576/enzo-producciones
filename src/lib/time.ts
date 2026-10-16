// Perú está en UTC-5 todo el año (sin horario de verano).
export const TZ = 'America/Lima';
const OFFSET = '-05:00';

/** Fecha de hoy en Perú: yyyy-mm-dd */
export function hoyPeru(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/** Mes actual en Perú: yyyy-mm */
export function mesPeru(): string {
  return hoyPeru().slice(0, 7);
}


/** Hora HH:mm (hora de Perú) a partir de un instante ISO */
export function horaPeru(
  iso: string | Date | null | undefined
): string {
  if (!iso) return '–';

  const fecha = iso instanceof Date ? iso : new Date(iso);

  if (Number.isNaN(fecha.getTime())) return '–';

  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
}


/** dd/mm/yyyy a partir de yyyy-mm-dd */
export function fmtFecha(f: string | null | undefined): string {
  if (!f) return '–';
  const [y, m, d] = f.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** dd/mm/yyyy HH:mm (hora de Perú) a partir de un instante */
export function fmtFechaHora(iso: string | Date | null | undefined): string {
  if (!iso) return '–';
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
  return `${fmtFecha(fecha)} ${horaPeru(iso)}`;
}

/** "08:30:00" -> "08:30" */
export function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '–';
}

/** Instante a partir de fecha (yyyy-mm-dd) y hora (HH:mm) de Perú */
export function peruADate(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora.slice(0, 5)}:00${OFFSET}`);
}

/** Date -> valor para <input type="datetime-local"> en hora de Perú */
export function aInputLocal(d: Date): string {
  return new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (hora de Perú) -> ISO */
export function deInputLocal(v: string): string {
  return new Date(`${v}:00${OFFSET}`).toISOString();
}

export function sumarMin(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

export function difMin(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60_000);
}

export function fmtDuracion(min: number): string {
  const m = Math.abs(Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** Primer y último día de un mes yyyy-mm */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
