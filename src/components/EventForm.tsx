
import { useEffect, useState } from 'react';
import { Search, LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { AreaTexto, Campo, Modal, Seleccion } from './ui';
import { MapView } from './MapView';
import { buscarDireccion, obtenerDireccion } from '../lib/geo';
import { hhmm, hoyPeru } from '../lib/time';
import { mensajeError } from '../lib/validar';
import { ESTADOS_EVENTO, type EstadoEvento, type Evento } from '../lib/types';

interface Form {
  nombre: string;
  cliente: string;
  fecha: string;
  hora_citacion: string;
  hora_inicio: string;
  hora_fin: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  radio_m: string;
  estado: EstadoEvento;
  notas: string;
}

const vacio = (): Form => ({
  nombre: '',
  cliente: '',
  fecha: hoyPeru(),
  hora_citacion: '',
  hora_inicio: '',
  hora_fin: '',
  direccion: '',
  lat: null,
  lng: null,
  radio_m: '100',
  estado: 'programado',
  notas: '',
});

export function EventForm({
  abierto,
  evento,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  evento: Evento | null;
  onCerrar: () => void;
  onGuardado: (id: string) => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();

  const [f, setF] = useState<Form>(vacio());
  const [err, setErr] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!abierto) return;

    setErr({});
    setF(
      evento
        ? {
            nombre: evento.nombre,
            cliente: evento.cliente,
            fecha: evento.fecha,
            hora_citacion: hhmm(evento.hora_citacion),
            hora_inicio: hhmm(evento.hora_inicio),
            hora_fin: hhmm(evento.hora_fin),
            direccion: evento.direccion,
            lat: evento.lat,
            lng: evento.lng,
            radio_m: String(evento.radio_m),
            estado: evento.estado,
            notas: evento.notas ?? '',
          }
        : vacio(),
    );
  }, [abierto, evento]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
  };

  /** Busca la dirección escrita y centra el mapa en ese lugar. */
  const buscar = async () => {
    if (f.direccion.trim().length < 4) {
      toast.error('Escribe una dirección para buscarla en el mapa.');
      return;
    }

    setBuscando(true);

    try {
      const r = await buscarDireccion(f.direccion.trim());

      if (!r) {
        toast.info(
          'No se encontró esa dirección. Prueba con el distrito, ciudad o una referencia.',
        );
        return;
      }

      setF((p) => ({
        ...p,
        direccion: r.nombre,
        lat: r.lat,
        lng: r.lng,
      }));

      setErr((p) => ({ ...p, direccion: undefined }));
      toast.ok('Dirección encontrada en el mapa.');
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setBuscando(false);
    }
  };

  /** Selecciona un punto y obtiene su dirección automáticamente. */
  const seleccionarPunto = async (lat: number, lng: number) => {
    setF((p) => ({ ...p, lat, lng }));
    setErr((p) => ({ ...p, direccion: undefined }));
    setBuscando(true);

    try {
      const direccion = await obtenerDireccion(lat, lng);

      if (direccion) {
        setF((p) => ({
          ...p,
          lat,
          lng,
          direccion,
        }));

        toast.ok('Dirección completada automáticamente.');
      } else {
        toast.info(
          'Punto marcado. No se encontró una dirección exacta; puedes escribirla manualmente.',
        );
      }
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setBuscando(false);
    }
  };

  const guardar = async () => {
    const e: Partial<Record<keyof Form, string>> = {};

    if (f.nombre.trim().length < 3) {
      e.nombre = 'Ingresa el nombre del evento.';
    }

    if (f.cliente.trim().length < 2) {
      e.cliente = 'Ingresa el cliente.';
    }

    if (!f.fecha) e.fecha = 'Selecciona la fecha.';
    if (!f.hora_citacion) e.hora_citacion = 'Requerida.';
    if (!f.hora_inicio) e.hora_inicio = 'Requerida.';
    if (!f.hora_fin) e.hora_fin = 'Requerida.';

    if (
      f.hora_inicio &&
      f.hora_fin &&
      f.hora_fin <= f.hora_inicio
    ) {
      e.hora_fin = 'Debe ser posterior al inicio.';
    }

    if (
      f.hora_citacion &&
      f.hora_inicio &&
      f.hora_citacion > f.hora_inicio
    ) {
      e.hora_citacion = 'No puede ser posterior al inicio del evento.';
    }

    if (f.direccion.trim().length < 5) {
      e.direccion = 'Ingresa una dirección válida.';
    }

    const radio = Number(f.radio_m);

    if (!Number.isInteger(radio) || radio < 10 || radio > 5000) {
      e.radio_m = 'Entre 10 y 5000 metros.';
    }

    if (f.lat === null || f.lng === null) {
      e.direccion = 'Busca una dirección o marca la ubicación en el mapa.';
    }

    setErr(e);

    if (Object.keys(e).length) {
      toast.error('Revisa los campos marcados.');
      return;
    }

    setBusy(true);

    try {
      const fila = {
        nombre: f.nombre.trim(),
        cliente: f.cliente.trim(),
        fecha: f.fecha,
        hora_citacion: f.hora_citacion,
        hora_inicio: f.hora_inicio,
        hora_fin: f.hora_fin,
        direccion: f.direccion.trim(),
        lat: f.lat,
        lng: f.lng,
        radio_m: radio,
        estado: f.estado,
        notas: f.notas.trim() || null,
      };

      const res = evento
        ? await supabase
            .from('events')
            .update(fila)
            .eq('id', evento.id)
            .select('id')
            .single()
        : await supabase
            .from('events')
            .insert({ ...fila, created_by: profile?.id })
            .select('id')
            .single();

      if (res.error) {
        toast.error(mensajeError(res.error));
        return;
      }

      toast.ok(evento ? 'Evento actualizado.' : 'Evento creado.');
      onGuardado((res.data as { id: string }).id);
      onCerrar();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo={evento ? 'Editar evento' : 'Nuevo evento'}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Nombre del evento"
            value={f.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            error={err.nombre}
          />
          <Campo
            label="Cliente"
            value={f.cliente}
            onChange={(e) => set('cliente', e.target.value)}
            error={err.cliente}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Campo
            label="Fecha"
            type="date"
            value={f.fecha}
            onChange={(e) => set('fecha', e.target.value)}
            error={err.fecha}
          />
          <Campo
            label="Citación del personal"
            type="time"
            value={f.hora_citacion}
            onChange={(e) => set('hora_citacion', e.target.value)}
            error={err.hora_citacion}
          />
          <Campo
            label="Inicio del evento"
            type="time"
            value={f.hora_inicio}
            onChange={(e) => set('hora_inicio', e.target.value)}
            error={err.hora_inicio}
          />
          <Campo
            label="Fin del evento"
            type="time"
            value={f.hora_fin}
            onChange={(e) => set('hora_fin', e.target.value)}
            error={err.hora_fin}
          />
        </div>

        <p className="-mt-2 text-xs text-slate-500">
          La hora de citación se utiliza para calcular las tardanzas y el inicio del montaje.
        </p>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Campo
              label="Dirección"
              value={f.direccion}
              onChange={(e) => set('direccion', e.target.value)}
              error={err.direccion}
            />
          </div>

          <button
            type="button"
            className="btn-secondary mb-[1px] h-[42px]"
            onClick={buscar}
            disabled={buscando}
          >
            {buscando ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        <MapView
          objetivo={
            f.lat !== null && f.lng !== null
              ? {
                  lat: f.lat,
                  lng: f.lng,
                  radio: Number(f.radio_m) || 100,
                  etiqueta: f.nombre || 'Ubicación del evento',
                }
              : null
          }
          onPick={seleccionarPunto}
          altura={260}
        />

        <p className="-mt-2 text-xs text-slate-500">
          {f.lat !== null && f.lng !== null
            ? `Ubicación: ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}. `
            : 'Aún sin ubicación. '}
          Haz clic en el mapa para seleccionar el punto y completar la dirección.
          {buscando ? ' Consultando ubicación…' : ''}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Radio permitido (metros)"
            type="number"
            min={10}
            max={5000}
            value={f.radio_m}
            onChange={(e) => set('radio_m', e.target.value)}
            error={err.radio_m}
            ayuda="Distancia máxima para considerar al trabajador dentro del área."
          />

          <Seleccion
            label="Estado"
            value={f.estado}
            onChange={(e) => set('estado', e.target.value as EstadoEvento)}
          >
            {Object.entries(ESTADOS_EVENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Seleccion>
        </div>

        <AreaTexto
          label="Notas (opcional)"
          value={f.notas}
          onChange={(e) => set('notas', e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCerrar}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={guardar}
          >
            {busy
              ? 'Guardando…'
              : evento
                ? 'Guardar cambios'
                : 'Crear evento'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

