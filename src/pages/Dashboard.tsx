import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { UserCheck, AlarmClock, UserX, CalendarClock, TimerOff, MapPinOff, CalendarCheck, Play, CheckCheck, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Alerta, Badge, Spinner, StatCard, Vacio } from '../components/ui';
import { planificar, type TareaPlan } from '../lib/schedule';
import { fmtDuracion, fmtFecha, hhmm, horaPeru, hoyPeru, peruADate, rangoMes, mesPeru, sumarDias } from '../lib/time';
import { mensajeError } from '../lib/validar';
import type { Asistencia, Evento, Tarea } from '../lib/types';
import { BadgeEvento } from './Eventos';

interface TareaEv extends Tarea { events: { nombre: string; fecha: string; hora_citacion: string; estado: string } }

export default function Dashboard() {
  const { profile, esStaff } = useAuth();
  const toast = useToast();
  const hoy = hoyPeru();
  const [cargando, setCargando] = useState(true);
  const [hoyAsist, setHoyAsist] = useState<Asistencia[]>([]);
  const [semana, setSemana] = useState<Asistencia[]>([]);
  const [mes, setMes] = useState<Asistencia[]>([]);
  const [proximos, setProximos] = useState<Evento[]>([]);
  const [tareas, setTareas] = useState<TareaEv[]>([]);

  const cargar = useCallback(async () => {
    if (!profile) return;
    const { desde, hasta } = rangoMes(mesPeru());
    const qHoy = supabase.from('attendance').select('*, profiles:worker_id(nombres,dni)').eq('fecha', hoy);
    const qSem = supabase.from('attendance').select('*').gte('fecha', sumarDias(hoy, -6)).lte('fecha', hoy);
    const qMes = supabase.from('attendance').select('*').eq('worker_id', profile.id).gte('fecha', desde).lte('fecha', hasta);
    const [h, s, m, ev, ta] = await Promise.all([
      esStaff ? qHoy : qHoy.eq('worker_id', profile.id),
      esStaff ? qSem : qSem.eq('worker_id', profile.id),
      qMes,
      supabase.from('events').select('*').gte('fecha', hoy).lte('fecha', sumarDias(hoy, 14)).not('estado', 'in', '("cancelado","finalizado")').order('fecha').order('hora_citacion'),
      supabase.from('tasks').select('*, events!inner(nombre,fecha,hora_citacion,estado)').lte('events.fecha', hoy).gte('events.fecha', sumarDias(hoy, -7)).in('events.estado', ['programado', 'en_montaje', 'en_curso']),
    ]);
    setHoyAsist((h.data as Asistencia[]) ?? []);
    setSemana((s.data as Asistencia[]) ?? []);
    setMes((m.data as Asistencia[]) ?? []);
    setProximos((ev.data as Evento[]) ?? []);
    setTareas((ta.data as unknown as TareaEv[]) ?? []);
    setCargando(false);
  }, [profile, esStaff, hoy]);
  useEffect(() => { void cargar(); }, [cargar]);

  // Actividades retrasadas: se calculan por evento con todas sus actividades (para respetar dependencias)
  const retrasadas = useMemo(() => {
    const porEvento = new Map<string, TareaEv[]>();
    tareas.forEach((t) => porEvento.set(t.event_id, [...(porEvento.get(t.event_id) ?? []), t]));
    const out: { plan: TareaPlan; evento: TareaEv['events'] }[] = [];
    porEvento.forEach((lista) => {
      const ev = lista[0].events;
      planificar(lista, peruADate(ev.fecha, ev.hora_citacion)).forEach((p) => {
        if (p.retrasada && p.tarea.estado !== 'completada' && (esStaff || p.tarea.responsable_id === profile?.id)) out.push({ plan: p, evento: ev });
      });
    });
    return out.sort((a, b) => b.plan.retrasoMin - a.plan.retrasoMin);
  }, [tareas, esStaff, profile]);

  const misPendientes = useMemo(() => tareas.filter((t) => t.responsable_id === profile?.id && t.estado !== 'completada'), [tareas, profile]);

  const grafico = useMemo(() => {
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6));
    return dias.map((d) => {
      const r = semana.filter((x) => x.fecha === d);
      return { dia: fmtFecha(d).slice(0, 5), Puntuales: r.filter((x) => x.estado === 'puntual').length, Tardanzas: r.filter((x) => x.estado === 'tardanza').length, Faltas: r.filter((x) => x.estado.startsWith('falta')).length };
    });
  }, [semana, hoy]);

  const cambiar = async (id: string, estado: 'en_progreso' | 'completada') => {
    const { error } = await supabase.rpc('actualizar_tarea', { p_id: id, p_estado: estado });
    if (error) { toast.error(mensajeError(error)); return; }
    toast.ok(estado === 'en_progreso' ? 'Actividad iniciada.' : 'Actividad completada.'); await cargar();
  };

  if (cargando) return <Spinner />;

  const presentes = hoyAsist.filter((a) => a.hora_entrada);
  const tardHoy = hoyAsist.filter((a) => a.estado === 'tardanza');
  const faltasHoy = hoyAsist.filter((a) => a.estado.startsWith('falta'));
  const fuera = presentes.filter((a) => a.entrada_dentro_area === false);
  const miHoy = hoyAsist.find((a) => a.worker_id === profile?.id);

  return (
    <>
      <div className="mb-6">
        
<h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
  Hola, {(profile?.nombres ?? 'Usuario').split(' ')[0]}
</h1>

        <p className="text-sm text-slate-500">{esStaff ? 'Resumen operativo de hoy.' : 'Tu resumen de hoy.'} {fmtFecha(hoy)}</p>
      </div>

      {esStaff ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icono={<UserCheck />} color="bg-emerald-100 text-emerald-600" etiqueta="Presentes hoy" valor={presentes.length} detalle={`${presentes.filter((a) => !a.hora_salida).length} sin salida`} />
          <StatCard icono={<AlarmClock />} color="bg-amber-100 text-amber-600" etiqueta="Tardanzas hoy" valor={tardHoy.length} detalle={`${tardHoy.reduce((s, a) => s + a.minutos_tardanza, 0)} min acumulados`} />
          <StatCard icono={<UserX />} color="bg-red-100 text-red-500" etiqueta="Faltas hoy" valor={faltasHoy.length} />
          <StatCard icono={<CalendarClock />} color="bg-sky-100 text-sky-600" etiqueta="Próximos eventos" valor={proximos.length} detalle="en 14 días" />
          <StatCard icono={<TimerOff />} color="bg-rose-100 text-rose-600" etiqueta="Actividades retrasadas" valor={retrasadas.length} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icono={<UserCheck />} color="bg-emerald-100 text-emerald-600" etiqueta="Hoy" valor={miHoy?.hora_entrada ? horaPeru(miHoy.hora_entrada) : '–'} detalle="Hora de ingreso" />
          <StatCard icono={<AlarmClock />} color="bg-amber-100 text-amber-600" etiqueta="Tardanzas" valor={mes.filter((a) => a.estado === 'tardanza').length} detalle="este mes" />
          <StatCard icono={<UserX />} color="bg-red-100 text-red-500" etiqueta="Faltas" valor={mes.filter((a) => a.estado.startsWith('falta')).length} detalle="este mes" />
          <StatCard icono={<CalendarCheck />} color="bg-indigo-100 text-indigo-600" etiqueta="Asistencias" valor={mes.filter((a) => a.estado === 'puntual' || a.estado === 'tardanza').length} detalle="este mes" />
        </div>
      )}

      {!esStaff && !miHoy && <div className="mt-5"><Alerta tipo="aviso">Aún no registras tu asistencia de hoy. <Link className="font-semibold underline" to="/app/asistencia">Marcar entrada</Link></Alerta></div>}
      {esStaff && fuera.length > 0 && (
        <div className="mt-5"><Alerta tipo="error"><MapPinOff size={16} className="mr-1 inline" /> <strong>{fuera.length}</strong> trabajador(es) marcaron entrada fuera del área autorizada hoy: {fuera.map((a) => `${a.profiles?.nombres} (${Math.round(a.entrada_distancia_m ?? 0)} m)`).join(', ')}.</Alerta></div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {esStaff && (
          <section className="card p-5 xl:col-span-3">
            <h2 className="mb-4 font-bold text-navy-900">Asistencia de los últimos 7 días</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="Puntuales" stackId="a" fill="#10b981" /><Bar dataKey="Tardanzas" stackId="a" fill="#f59e0b" /><Bar dataKey="Faltas" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section className={`card p-5 ${esStaff ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-navy-900">Próximos eventos</h2><Link to="/app/eventos" className="text-sm text-brand hover:underline">Ver todos</Link></div>
          {proximos.length === 0 ? <Vacio texto="No hay eventos en los próximos 14 días." /> : (
            <ul className="divide-y divide-slate-100">
              {proximos.slice(0, 6).map((e) => (
                <li key={e.id}><Link to={`/app/eventos/${e.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <div className="min-w-0"><p className="truncate font-medium text-navy-900">{e.nombre}</p><p className="text-xs text-slate-500">{fmtFecha(e.fecha)} · citación {hhmm(e.hora_citacion)}</p></div>
                  <BadgeEvento e={e.estado} />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">Actividades retrasadas</h2>
          {retrasadas.length === 0 ? <Vacio texto="No hay actividades retrasadas. ¡Todo va según lo planeado!" /> : (
            <ul className="divide-y divide-slate-100">
              {retrasadas.slice(0, 8).map(({ plan, evento }) => (
                <li key={plan.tarea.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate font-medium">{plan.tarea.nombre}</p><p className="text-xs text-slate-500">{evento.nombre} · debía terminar {horaPeru(plan.fin)}</p></div>
                  <Badge color="rojo">+{fmtDuracion(plan.retrasoMin)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold text-navy-900">{esStaff ? 'Tardanzas y faltas de hoy' : 'Mis actividades pendientes'}</h2>
          {esStaff ? (
            tardHoy.length + faltasHoy.length === 0 ? <Vacio texto="Sin tardanzas ni faltas registradas hoy." /> : (
              <ul className="divide-y divide-slate-100">
                {[...tardHoy, ...faltasHoy].map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3 text-sm"><span className="font-medium">{a.profiles?.nombres}</span>
                    {a.estado === 'tardanza' ? <Badge color="ambar">{a.minutos_tardanza} min tarde</Badge> : <Badge color={a.estado === 'falta_justificada' ? 'azul' : 'rojo'}>{a.estado === 'falta_justificada' ? 'Falta justificada' : 'Falta'}</Badge>}</li>
                ))}
              </ul>
            )
          ) : misPendientes.length === 0 ? <Vacio texto="No tienes actividades pendientes." /> : (
            <ul className="divide-y divide-slate-100">
              {misPendientes.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate font-medium">{t.nombre}</p><p className="text-xs text-slate-500">{t.events.nombre} · {fmtFecha(t.events.fecha)} · {fmtDuracion(t.duracion_min)}</p></div>
                  {t.estado === 'pendiente'
                    ? <button className="btn-primary btn-sm" onClick={() => cambiar(t.id, 'en_progreso')}><Play size={13} /> Iniciar</button>
                    : <button className="btn-primary btn-sm !bg-emerald-600 hover:!bg-emerald-700" onClick={() => cambiar(t.id, 'completada')}><CheckCheck size={13} /> Finalizar</button>}
                </li>
              ))}
            </ul>
          )}
          {!esStaff && <Link to="/app/asistencia" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">Ir a asistencia <ArrowRight size={14} /></Link>}
        </section>
      </div>
    </>
  );
}
