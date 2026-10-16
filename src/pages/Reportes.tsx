import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Badge, Campo, Encabezado, Seleccion, Spinner, Vacio } from '../components/ui';
import { BadgeArea, BadgeEstado } from './Asistencia';
import { descargarCSV } from '../lib/csv';
import { planificar, type TareaPlan } from '../lib/schedule';
import { fmtDuracion, fmtFecha, fmtFechaHora, horaPeru, hoyPeru, peruADate, rangoMes, mesPeru } from '../lib/time';
import { mensajeError } from '../lib/validar';
import { CATEGORIAS, ESTADOS_ASISTENCIA, type Asistencia, type Profile, type Tarea } from '../lib/types';

type Tipo = 'asistencia' | 'actividades';
interface TareaEv extends Tarea { events: { nombre: string; fecha: string; hora_citacion: string } }
interface EvLite { id: string; nombre: string; fecha: string }
interface FilaTarea { plan: TareaPlan; evento: TareaEv['events']; responsable: string }

export default function Reportes() {
  const toast = useToast();
  const [tipo, setTipo] = useState<Tipo>('asistencia');
  const [desde, setDesde] = useState(rangoMes(mesPeru()).desde);
  const [hasta, setHasta] = useState(hoyPeru());
  const [trabajador, setTrabajador] = useState('');
  const [evento, setEvento] = useState('');
  const [trabajadores, setTrabajadores] = useState<Profile[]>([]);
  const [eventos, setEventos] = useState<EvLite[]>([]);
  const [asist, setAsist] = useState<Asistencia[]>([]);
  const [filasT, setFilasT] = useState<FilaTarea[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('nombres'),
      supabase.from('events').select('id,nombre,fecha').order('fecha', { ascending: false }).limit(300),
    ]).then(([p, e]) => { setTrabajadores((p.data as Profile[]) ?? []); setEventos((e.data as EvLite[]) ?? []); });
  }, []);

  const nombres = useMemo(() => new Map(trabajadores.map((t) => [t.id, t.nombres])), [trabajadores]);

  const generar = useCallback(async () => {
    if (!desde || !hasta || desde > hasta) { toast.error('El rango de fechas no es válido.'); return; }
    setCargando(true);
    try {
      if (tipo === 'asistencia') {
        let q = supabase.from('attendance').select('*, profiles:worker_id(nombres,dni), events:event_id(nombre,lat,lng,radio_m)').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false });
        if (trabajador) q = q.eq('worker_id', trabajador);
        if (evento) q = q.eq('event_id', evento);
        const { data, error } = await q;
        if (error) throw error;
        setAsist((data as Asistencia[]) ?? []);
      } else {
        let q = supabase.from('tasks').select('*, events!inner(nombre,fecha,hora_citacion)').gte('events.fecha', desde).lte('events.fecha', hasta);
        if (evento) q = q.eq('event_id', evento);
        const { data, error } = await q;
        if (error) throw error;
        const todas = (data as unknown as TareaEv[]) ?? [];
        const porEv = new Map<string, TareaEv[]>();
        todas.forEach((t) => porEv.set(t.event_id, [...(porEv.get(t.event_id) ?? []), t]));
        const filas: FilaTarea[] = [];
        porEv.forEach((lista) => {
          const ev = lista[0].events;
          planificar(lista, peruADate(ev.fecha, ev.hora_citacion)).forEach((p) => {
            if (!trabajador || p.tarea.responsable_id === trabajador) filas.push({ plan: p, evento: ev, responsable: nombres.get(p.tarea.responsable_id ?? '') ?? 'Sin asignar' });
          });
        });
        setFilasT(filas.sort((a, b) => a.plan.inicio.getTime() - b.plan.inicio.getTime()));
      }
    } catch (e) { toast.error(mensajeError(e)); }
    finally { setCargando(false); }
  }, [tipo, desde, hasta, trabajador, evento, nombres]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (trabajadores.length) void generar(); }, [generar, trabajadores.length]);

  const resumenA = useMemo(() => ({
    total: asist.length,
    puntuales: asist.filter((a) => a.estado === 'puntual').length,
    tardanzas: asist.filter((a) => a.estado === 'tardanza').length,
    minTard: asist.reduce((s, a) => s + a.minutos_tardanza, 0),
    fj: asist.filter((a) => a.estado === 'falta_justificada').length,
    fi: asist.filter((a) => a.estado === 'falta_injustificada').length,
    fuera: asist.filter((a) => a.entrada_dentro_area === false).length,
  }), [asist]);

  const exportar = () => {
    if (tipo === 'asistencia') {
      if (!asist.length) { toast.info('No hay datos para exportar.'); return; }
      descargarCSV(`reporte_asistencia_${desde}_a_${hasta}`,
        ['Fecha', 'Trabajador', 'DNI', 'Evento / lugar', 'Hora programada', 'Entrada', 'Salida', 'Minutos de tardanza', 'Estado', 'Entrada dentro del área', 'Distancia entrada (m)', 'Latitud entrada', 'Longitud entrada', 'Salida dentro del área', 'Observaciones', 'Justificación'],
        asist.map((a) => [fmtFecha(a.fecha), a.profiles?.nombres, a.profiles?.dni, a.events?.nombre ?? (a.hora_entrada ? 'Sede' : ''), horaPeru(a.hora_programada).replace('–', ''), horaPeru(a.hora_entrada).replace('–', ''), horaPeru(a.hora_salida).replace('–', ''), a.minutos_tardanza, ESTADOS_ASISTENCIA[a.estado],
          a.entrada_dentro_area === null ? '' : a.entrada_dentro_area ? 'Sí' : 'No', a.entrada_distancia_m === null ? '' : Math.round(a.entrada_distancia_m), a.entrada_lat, a.entrada_lng, a.salida_dentro_area === null ? '' : a.salida_dentro_area ? 'Sí' : 'No', a.observaciones, a.justificacion]));
    } else {
      if (!filasT.length) { toast.info('No hay datos para exportar.'); return; }
      descargarCSV(`reporte_montaje_${desde}_a_${hasta}`,
        ['Evento', 'Fecha del evento', 'Actividad', 'Categoría', 'Responsable', 'Inicio planificado', 'Duración (min)', 'Fin estimado', 'Inicio real', 'Fin real', 'Tiempo real (min)', 'Estado', 'Retraso (min)'],
        filasT.map(({ plan: p, evento: e, responsable }) => [e.nombre, fmtFecha(e.fecha), p.tarea.nombre, CATEGORIAS[p.tarea.categoria], responsable, fmtFechaHora(p.inicio), p.tarea.duracion_min, fmtFechaHora(p.fin), fmtFechaHora(p.inicioReal), fmtFechaHora(p.finReal), p.tiempoRealMin ?? '', p.tarea.estado, p.retrasoMin]));
    }
    toast.ok('Reporte exportado en CSV.');
  };

  return (
    <>
      <Encabezado titulo="Reportes" subtitulo="Filtra por fecha, trabajador y evento. Exporta a CSV para Excel.">
        <button className="btn-primary" onClick={exportar}><Download size={18} /> Exportar CSV</button>
      </Encabezado>

      <div className="card mb-5 grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <Seleccion label="Reporte" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}><option value="asistencia">Asistencia</option><option value="actividades">Actividades de montaje</option></Seleccion>
        <Campo label="Desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        <Campo label="Hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        <Seleccion label="Trabajador" value={trabajador} onChange={(e) => setTrabajador(e.target.value)}><option value="">Todos</option>{trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombres}</option>)}</Seleccion>
        <Seleccion label="Evento" value={evento} onChange={(e) => setEvento(e.target.value)}><option value="">Todos</option>{eventos.map((e) => <option key={e.id} value={e.id}>{fmtFecha(e.fecha)} · {e.nombre}</option>)}</Seleccion>
      </div>

      {cargando ? <Spinner /> : tipo === 'asistencia' ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {[['Registros', resumenA.total], ['Puntuales', resumenA.puntuales], ['Tardanzas', resumenA.tardanzas], ['Min. de tardanza', resumenA.minTard], ['Faltas justif.', resumenA.fj], ['Faltas injustif.', resumenA.fi], ['Fuera de área', resumenA.fuera]].map(([t, v]) => (
              <div key={t} className="card p-3 text-center"><p className="text-2xl font-bold text-navy-900">{v}</p><p className="text-xs text-slate-500">{t}</p></div>
            ))}
          </div>
          {asist.length === 0 ? <div className="card"><Vacio texto="No hay registros con estos filtros." /></div> : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Fecha</th><th className="th">Trabajador</th><th className="th">Evento / lugar</th><th className="th">Entrada</th><th className="th">Salida</th><th className="th">Tardanza</th><th className="th">Estado</th><th className="th">Área</th><th className="th">Observaciones</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {asist.map((a) => (
                    <tr key={a.id}><td className="td">{fmtFecha(a.fecha)}</td><td className="td font-medium">{a.profiles?.nombres}</td><td className="td">{a.events?.nombre ?? (a.hora_entrada ? 'Sede' : '–')}</td>
                      <td className="td">{horaPeru(a.hora_entrada)}</td><td className="td">{horaPeru(a.hora_salida)}</td><td className="td">{a.minutos_tardanza ? `${a.minutos_tardanza} min` : '–'}</td>
                      <td className="td"><BadgeEstado e={a.estado} /></td><td className="td">{a.hora_entrada ? <BadgeArea dentro={a.entrada_dentro_area} dist={a.entrada_distancia_m} /> : '–'}</td>
                      <td className="td max-w-[16rem] text-slate-600">{[a.observaciones, a.justificacion && `Justificación: ${a.justificacion}`].filter(Boolean).join(' · ') || '–'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : filasT.length === 0 ? <div className="card"><Vacio texto="No hay actividades de montaje con estos filtros." /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Evento</th><th className="th">Actividad</th><th className="th">Responsable</th><th className="th">Plan</th><th className="th">Duración</th><th className="th">Real</th><th className="th">Estado</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filasT.map(({ plan: p, evento: e, responsable }) => (
                <tr key={p.tarea.id}><td className="td"><p className="font-medium">{e.nombre}</p><p className="text-xs text-slate-500">{fmtFecha(e.fecha)}</p></td>
                  <td className="td">{p.tarea.nombre}<p className="text-xs text-slate-500">{CATEGORIAS[p.tarea.categoria]}</p></td><td className="td">{responsable}</td>
                  <td className="td tabular-nums">{horaPeru(p.inicio)}–{horaPeru(p.fin)}</td><td className="td">{fmtDuracion(p.tarea.duracion_min)}</td>
                  <td className="td">{p.inicioReal ? `${horaPeru(p.inicioReal)}–${p.finReal ? horaPeru(p.finReal) : 'en curso'}` : '–'}{p.tiempoRealMin !== null && <p className="text-xs text-slate-500">{fmtDuracion(p.tiempoRealMin)}</p>}</td>
                  <td className="td">{p.tarea.estado === 'completada' ? <Badge color={p.retrasoMin > 0 ? 'ambar' : 'verde'}>Completada{p.retrasoMin > 0 ? ` +${fmtDuracion(p.retrasoMin)}` : ''}</Badge> : p.retrasada ? <Badge color="rojo">Retrasada +{fmtDuracion(p.retrasoMin)}</Badge> : <Badge color="gris">{p.tarea.estado === 'en_progreso' ? 'En progreso' : 'Pendiente'}</Badge>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><Search size={12} /> Horas en zona horaria de Perú.</p>
    </>
  );
}
