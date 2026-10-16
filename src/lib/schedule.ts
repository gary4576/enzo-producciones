import type { Tarea } from './types';
import { difMin, sumarMin } from './time';

export interface TareaPlan {
  tarea: Tarea;
  inicio: Date; // inicio planificado (calculado)
  fin: Date; // fin estimado = inicio + duración
  inicioReal: Date | null;
  finReal: Date | null;
  tiempoRealMin: number | null; // duración real (o en curso)
  retrasoMin: number; // > 0 = retraso respecto del fin estimado
  retrasada: boolean;
  inicioTardio: boolean; // debía empezar y aún está pendiente
}

/**
 * Calcula automáticamente los horarios de las actividades de un evento.
 *  - Inicio = el mayor entre su inicio manual (si existe) y el fin de todas sus dependencias.
 *  - Si no tiene inicio manual ni dependencias, inicia a la hora de citación (base).
 *  - Fin estimado = inicio + duración en minutos.
 *  - Las actividades sin dependencia entre sí corren en paralelo.
 */
export function planificar(tareas: Tarea[], base: Date, ahora: Date = new Date()): TareaPlan[] {
  const porId = new Map(tareas.map((t) => [t.id, t]));
  const memo = new Map<string, { inicio: Date; fin: Date }>();
  const visitando = new Set<string>();

  const calc = (t: Tarea): { inicio: Date; fin: Date } => {
    const m = memo.get(t.id);
    if (m) return m;
    if (visitando.has(t.id)) return { inicio: base, fin: sumarMin(base, t.duracion_min) }; // ciclo: se ignora
    visitando.add(t.id);
    let inicio = t.inicio_plan ? new Date(t.inicio_plan) : new Date(base);
    for (const d of t.depende_de) {
      const dep = porId.get(d);
      if (dep) {
        const fin = calc(dep).fin;
        if (fin > inicio) inicio = fin;
      }
    }
    visitando.delete(t.id);
    const r = { inicio, fin: sumarMin(inicio, t.duracion_min) };
    memo.set(t.id, r);
    return r;
  };

  return tareas
    .map((t) => {
      const { inicio, fin } = calc(t);
      const inicioReal = t.inicio_real ? new Date(t.inicio_real) : null;
      const finReal = t.fin_real ? new Date(t.fin_real) : null;
      let tiempoRealMin: number | null = null;
      if (inicioReal) tiempoRealMin = difMin(finReal ?? ahora, inicioReal);

      let retrasoMin = 0;
      if (t.estado === 'completada' && finReal) retrasoMin = Math.max(0, difMin(finReal, fin));
      else if (ahora > fin) retrasoMin = difMin(ahora, fin);

      const retrasada = retrasoMin > 0;
      const inicioTardio = t.estado === 'pendiente' && ahora > inicio;
      return { tarea: t, inicio, fin, inicioReal, finReal, tiempoRealMin, retrasoMin, retrasada, inicioTardio };
    })
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** Detecta responsables con actividades superpuestas (mismo trabajador, mismo horario). */
export function conflictosResponsable(planes: TareaPlan[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i], b = planes[j];
      if (!a.tarea.responsable_id || a.tarea.responsable_id !== b.tarea.responsable_id) continue;
      if (a.inicio < b.fin && b.inicio < a.fin) {
        out.set(a.tarea.id, [...(out.get(a.tarea.id) ?? []), b.tarea.nombre]);
        out.set(b.tarea.id, [...(out.get(b.tarea.id) ?? []), a.tarea.nombre]);
      }
    }
  }
  return out;
}
