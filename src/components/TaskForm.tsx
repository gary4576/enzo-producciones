import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { AreaTexto, Alerta, Campo, Modal, Seleccion } from './ui';
import { aInputLocal, deInputLocal } from '../lib/time';
import { mensajeError } from '../lib/validar';
import { CATEGORIAS, type Categoria, type MiembroEquipo, type Tarea } from '../lib/types';
import type { TareaPlan } from '../lib/schedule';

interface Form { nombre: string; categoria: Categoria; responsable_id: string; duracion: string; inicio: string; depende_de: string[]; notas: string }

export function TaskForm({ abierto, eventId, tarea, tareas, equipo, base, onCerrar, onGuardado }: {
  abierto: boolean; eventId: string; tarea: Tarea | null; tareas: Tarea[]; equipo: MiembroEquipo[]; base: Date;
  onCerrar: () => void; onGuardado: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Form>({ nombre: '', categoria: 'otro', responsable_id: '', duracion: '60', inicio: '', depende_de: [], notas: '' });
  const [err, setErr] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setErr({});
    setF(tarea ? {
      nombre: tarea.nombre, categoria: tarea.categoria, responsable_id: tarea.responsable_id ?? '', duracion: String(tarea.duracion_min),
      inicio: tarea.inicio_plan ? aInputLocal(new Date(tarea.inicio_plan)) : '', depende_de: tarea.depende_de, notas: tarea.notas ?? '',
    } : { nombre: '', categoria: 'otro', responsable_id: '', duracion: '60', inicio: '', depende_de: [], notas: '' });
  }, [abierto, tarea]);

  const posibles = tareas.filter((t) => t.id !== tarea?.id);
  const alternar = (id: string) => setF((p) => ({ ...p, depende_de: p.depende_de.includes(id) ? p.depende_de.filter((x) => x !== id) : [...p.depende_de, id] }));

  // Evita dependencias circulares
  const generaCiclo = (): boolean => {
    if (!tarea) return false;
    const mapa = new Map(tareas.map((t) => [t.id, t.id === tarea.id ? f.depende_de : t.depende_de]));
    const visto = new Set<string>();
    const pila = [...f.depende_de];
    while (pila.length) {
      const id = pila.pop()!;
      if (id === tarea.id) return true;
      if (visto.has(id)) continue;
      visto.add(id);
      pila.push(...(mapa.get(id) ?? []));
    }
    return false;
  };

  const guardar = async () => {
    const e: typeof err = {};
    if (f.nombre.trim().length < 3) e.nombre = 'Describe la actividad.';
    const dur = Number(f.duracion);
    if (!Number.isInteger(dur) || dur < 1 || dur > 1440) e.duracion = 'Entre 1 y 1440 minutos.';
    if (!f.responsable_id) e.responsable_id = 'Asigna un responsable.';
    if (generaCiclo()) e.depende_de = 'Las dependencias forman un ciclo.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const fila = {
      event_id: eventId, nombre: f.nombre.trim(), categoria: f.categoria, responsable_id: f.responsable_id, duracion_min: dur,
      inicio_plan: f.inicio ? deInputLocal(f.inicio) : null, depende_de: f.depende_de, notas: f.notas.trim() || null,
    };
    const { error } = tarea ? await supabase.from('tasks').update(fila).eq('id', tarea.id) : await supabase.from('tasks').insert(fila);
    setBusy(false);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.ok(tarea ? 'Actividad actualizada.' : 'Actividad creada.');
    onGuardado(); onCerrar();
  };

  return (
    <Modal abierto={abierto} titulo={tarea ? 'Editar actividad' : 'Nueva actividad de montaje'} onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        <Campo label="Actividad" placeholder="Ej.: Instalar pantalla LED principal" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} error={err.nombre} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Seleccion label="Categoría" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as Categoria })}>
            {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Seleccion>
          <Seleccion label="Responsable" value={f.responsable_id} onChange={(e) => setF({ ...f, responsable_id: e.target.value })} error={err.responsable_id}>
            <option value="">Selecciona…</option>{equipo.map((m) => <option key={m.worker_id} value={m.worker_id}>{m.nombres} · {m.cargo}</option>)}
          </Seleccion>
        </div>
        {equipo.length === 0 && <Alerta tipo="aviso">Primero asigna trabajadores al evento para poder elegir un responsable.</Alerta>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Duración (minutos)" type="number" min={1} value={f.duracion} onChange={(e) => setF({ ...f, duracion: e.target.value })} error={err.duracion} />
          <Campo label="Hora de inicio (opcional)" type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })}
            ayuda="Si lo dejas vacío, inicia al terminar sus dependencias o a la hora de citación." />
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Depende de (debe terminar antes)</legend>
          {posibles.length === 0 ? <p className="text-xs text-slate-500">No hay otras actividades. Esta se ejecutará en paralelo con las demás.</p> : (
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
              {posibles.map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={f.depende_de.includes(t.id)} onChange={() => alternar(t.id)} /> {t.nombre}
                </label>
              ))}
            </div>
          )}
          {err.depende_de && <span className="text-xs text-red-600">{err.depende_de}</span>}
          <p className="mt-1 text-xs text-slate-500">Las actividades sin dependencias entre sí se ejecutan al mismo tiempo. Hora base del montaje: {base.toLocaleString('es-PE', { timeZone: 'America/Lima' })}.</p>
        </fieldset>
        <AreaTexto label="Notas (opcional)" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onCerrar}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar actividad'}</button></div>
      </div>
    </Modal>
  );
}

export type { TareaPlan };
