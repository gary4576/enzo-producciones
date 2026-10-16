
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, Plus, Play, CheckCheck, UserPlus, X,
  MapPin, Clock, AlertTriangle, Users, Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Alerta, Badge, Campo, Encabezado, Seleccion, Spinner, Vacio } from '../components/ui';
import { MapView } from '../components/MapView';
import { Gantt } from '../components/Gantt';
import { EventForm } from '../components/EventForm';
import { TaskForm } from '../components/TaskForm';
import { BadgeEvento } from './Eventos';
import { BadgeEstado, BadgeArea } from './Asistencia';
import { conflictosResponsable, planificar } from '../lib/schedule';
import { fmtDuracion, fmtFecha, hhmm, horaPeru, peruADate } from '../lib/time';
import { mensajeError } from '../lib/validar';
import {
  CATEGORIAS,
  type Asistencia,
  type Equipo,
  type Evento,
  type MiembroEquipo,
  type Profile,
  type Tarea,
} from '../lib/types';

type Pestana = 'resumen' | 'montaje' | 'asistencia';

export default function EventoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { profile, esStaff, esAdmin } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [asist, setAsist] = useState<Asistencia[]>([]);
  const [todos, setTodos] = useState<Profile[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Pestana>('resumen');
  const [editando, setEditando] = useState(false);
  const [tareaForm, setTareaForm] = useState<{ abierto: boolean; tarea: Tarea | null }>({
    abierto: false,
    tarea: null,
  });
  const [ahora, setAhora] = useState(new Date());
  const [nuevoTrab, setNuevoTrab] = useState('');
  const [eqNombre, setEqNombre] = useState('');
  const [eqCant, setEqCant] = useState('1');

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const cargar = useCallback(async () => {
    if (!id) {
      setCargando(false);
      return;
    }

    setCargando(true);

    const [e, m, q, t] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).maybeSingle(),
      supabase.from('event_workers').select('event_id, worker_id').eq('event_id', id),
      supabase.from('event_equipment').select('*').eq('event_id', id).order('nombre'),
      supabase.from('tasks').select('*').eq('event_id', id),
    ]);

    if (e.error) toast.error(mensajeError(e.error));
    if (m.error) toast.error(`Error al cargar los trabajadores: ${mensajeError(m.error)}`);
    if (q.error) toast.error(mensajeError(q.error));
    if (t.error) toast.error(mensajeError(t.error));

    setEvento((e.data as Evento) ?? null);
    setEquipos((q.data as Equipo[]) ?? []);
    setTareas((t.data as Tarea[]) ?? []);

    // Obtener los datos de los trabajadores que están asignados al evento.
    const asignaciones = m.data ?? [];
    const idsTrabajadores = asignaciones.map((item) => item.worker_id);

    let perfilesAsignados: {
      id: string;
      nombres: string;
      cargo: string;
      especialidad: string | null;
    }[] = [];

    if (idsTrabajadores.length > 0) {
      const { data: perfiles, error: errorPerfiles } = await supabase
        .from('profiles')
        .select('id, nombres, cargo, especialidad')
        .in('id', idsTrabajadores);

      if (errorPerfiles) {
        toast.error(`Error al obtener los nombres: ${mensajeError(errorPerfiles)}`);
      } else {
        perfilesAsignados = (perfiles ?? []) as typeof perfilesAsignados;
      }
    }

    const equipoCargado: MiembroEquipo[] = asignaciones.map((item) => {
      const trabajador = perfilesAsignados.find((p) => p.id === item.worker_id);

      return {
        event_id: item.event_id,
        worker_id: item.worker_id,
        nombres: trabajador?.nombres ?? 'Sin nombre',
        cargo: trabajador?.cargo ?? '',
        especialidad: trabajador?.especialidad ?? null,
      } as MiembroEquipo;
    });

    setEquipo(equipoCargado);

    if (esStaff) {
      const [a, p] = await Promise.all([
        supabase
          .from('attendance')
          .select('*, profiles:worker_id(nombres,dni)')
          .eq('event_id', id)
          .order('hora_entrada'),
        supabase
          .from('profiles')
          .select('*')
          .eq('activo', true)
          .order('nombres'),
      ]);

      if (a.error) toast.error(mensajeError(a.error));
      if (p.error) toast.error(mensajeError(p.error));

      setAsist((a.data as Asistencia[]) ?? []);
      setTodos((p.data as Profile[]) ?? []);
    }

    setCargando(false);
  }, [id, esStaff, toast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombreResp = useCallback(
    (rid: string | null) =>
      equipo.find((m) => m.worker_id === rid)?.nombres ??
      (rid && rid === profile?.id ? profile.nombres : 'Sin asignar'),
    [equipo, profile],
  );

  const base = useMemo(
    () => (evento ? peruADate(evento.fecha, evento.hora_citacion) : new Date()),
    [evento],
  );

  const planes = useMemo(() => planificar(tareas, base, ahora), [tareas, base, ahora]);
  const conflictos = useMemo(() => conflictosResponsable(planes), [planes]);

  if (cargando) return <Spinner />;

  if (!evento) {
    return (
      <div className="card">
        <Vacio texto="No se encontró el evento o no tienes acceso a él.">
          <Link className="btn-secondary btn-sm" to="/app/eventos">
            Volver a eventos
          </Link>
        </Vacio>
      </div>
    );
  }

  const finMontaje = planes.length
    ? new Date(Math.max(...planes.map((p) => p.fin.getTime())))
    : null;

  const retrasadas = planes.filter(
    (p) => p.retrasada && p.tarea.estado !== 'completada',
  );

  const inicioEvento = peruADate(evento.fecha, evento.hora_inicio);
  const montajeTarde = finMontaje && finMontaje > inicioEvento;

  const exec = async (
    p: PromiseLike<{ error: { message: string } | null }>,
    ok: string,
  ) => {
    const { error } = await p;

    if (error) {
      toast.error(mensajeError(error));
      return false;
    }

    toast.ok(ok);
    await cargar();
    return true;
  };

  const asignar = async () => {
    if (!nuevoTrab) return;

    const ok = await exec(
      supabase.from('event_workers').insert({
        event_id: evento.id,
        worker_id: nuevoTrab,
      }),
      'Trabajador asignado.',
    );

    if (ok) setNuevoTrab('');
  };

  const quitar = (wid: string) => {
    if (
      tareas.some((t) => t.responsable_id === wid) &&
      !confirm('Este trabajador tiene actividades asignadas en este evento. ¿Quitarlo igualmente?')
    ) {
      return;
    }

    void exec(
      supabase
        .from('event_workers')
        .delete()
        .eq('event_id', evento.id)
        .eq('worker_id', wid),
      'Trabajador retirado del evento.',
    );
  };

  const agregarEquipo = () => {
    const c = Number(eqCant);

    if (eqNombre.trim().length < 2) {
      toast.error('Escribe el nombre del equipo.');
      return;
    }

    if (!Number.isInteger(c) || c < 1) {
      toast.error('La cantidad debe ser un número entero mayor a 0.');
      return;
    }

    void exec(
      supabase.from('event_equipment').insert({
        event_id: evento.id,
        nombre: eqNombre.trim(),
        cantidad: c,
      }),
      'Equipo agregado.',
    ).then((ok) => {
      if (ok) {
        setEqNombre('');
        setEqCant('1');
      }
    });
  };

  const cambiarEstado = (
    t: Tarea,
    estado: 'en_progreso' | 'completada' | 'pendiente',
  ) =>
    exec(
      supabase.rpc('actualizar_tarea', {
        p_id: t.id,
        p_estado: estado,
      }),
      estado === 'en_progreso'
        ? 'Actividad iniciada.'
        : estado === 'completada'
          ? 'Actividad completada.'
          : 'Actividad reiniciada.',
    );

  const borrarTarea = (t: Tarea) =>
    confirm(`¿Eliminar la actividad "${t.nombre}"?`) &&
    exec(
      supabase.from('tasks').delete().eq('id', t.id),
      'Actividad eliminada.',
    );

  const borrarEvento = async () => {
    if (
      !confirm(
        `¿Eliminar el evento "${evento.nombre}"? Se borrarán sus actividades y asignaciones.`,
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', evento.id);

    if (error) {
      toast.error(mensajeError(error));
      return;
    }

    toast.ok('Evento eliminado.');
    nav('/app/eventos');
  };

  const disponibles = todos.filter(
    (p) => !equipo.some((m) => m.worker_id === p.id),
  );

  const pestanas: { k: Pestana; t: string; ver: boolean }[] = [
    { k: 'resumen', t: 'Resumen', ver: true },
    { k: 'montaje', t: `Montaje (${tareas.length})`, ver: true },
    { k: 'asistencia', t: 'Asistencia', ver: esStaff },
  ];

  return (
    <>
      <Link
        to="/app/eventos"
        className="mb-3 inline-flex items-center gap-1 text-sm text-brand hover:underline"
      >
        <ArrowLeft size={16} /> Eventos
      </Link>

      <Encabezado titulo={evento.nombre} subtitulo={`Cliente: ${evento.cliente}`}>
        <BadgeEvento e={evento.estado} />
        {esStaff && (
          <button className="btn-secondary btn-sm" onClick={() => setEditando(true)}>
            <Pencil size={14} /> Editar
          </button>
        )}
        {esAdmin && (
          <button
            className="btn-secondary btn-sm !text-red-600"
            onClick={borrarEvento}
          >
            <Trash2 size={14} /> Eliminar
          </button>
        )}
      </Encabezado>

      <div
        role="tablist"
        className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {pestanas.filter((p) => p.ver).map((p) => (
          <button
            key={p.k}
            role="tab"
            aria-selected={tab === p.k}
            onClick={() => setTab(p.k)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === p.k
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {p.t}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card space-y-3 p-5">
            <h2 className="font-bold text-navy-900">Datos del evento</h2>
            <p className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-brand" />
              {fmtFecha(evento.fecha)} · citación{' '}
              <strong>{hhmm(evento.hora_citacion)}</strong> · evento{' '}
              {hhmm(evento.hora_inicio)}–{hhmm(evento.hora_fin)}
            </p>
            <p className="flex items-start gap-2 text-sm">
              <MapPin size={16} className="mt-0.5 shrink-0 text-brand" />
              {evento.direccion}
            </p>
            <p className="text-sm text-slate-600">
              Radio permitido para marcar asistencia:{' '}
              <strong>{evento.radio_m} m</strong>
            </p>
            {evento.notas && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {evento.notas}
              </p>
            )}
            {evento.lat !== null && evento.lng !== null ? (
              <MapView
                objetivo={{
                  lat: evento.lat,
                  lng: evento.lng,
                  radio: evento.radio_m,
                  etiqueta: evento.nombre,
                }}
                altura={260}
              />
            ) : (
              <Alerta tipo="aviso">
                Este evento no tiene ubicación en el mapa.
              </Alerta>
            )}
          </section>

          <div className="space-y-6">
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-navy-900">
                <Users size={18} /> Trabajadores asignados ({equipo.length})
              </h2>

              {equipo.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aún no hay trabajadores asignados.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {equipo.map((m) => (
                    <li
                      key={m.worker_id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span>
                        <strong>{m.nombres}</strong>{' '}
                        <span className="text-slate-500">
                          · {m.cargo}
                          {m.especialidad ? ` · ${m.especialidad}` : ''}
                        </span>
                      </span>
                      {esStaff && (
                        <button
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => quitar(m.worker_id)}
                          aria-label={`Quitar a ${m.nombres}`}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {esStaff && (
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <Seleccion
                      label="Asignar trabajador"
                      value={nuevoTrab}
                      onChange={(e) => setNuevoTrab(e.target.value)}
                    >
                      <option value="">Selecciona…</option>
                      {disponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombres} · {p.cargo}
                        </option>
                      ))}
                    </Seleccion>
                  </div>
                  <button
                    className="btn-primary h-[42px]"
                    onClick={asignar}
                    disabled={!nuevoTrab}
                  >
                    <UserPlus size={16} /> Asignar
                  </button>
                </div>
              )}
            </section>

            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-navy-900">
                <Wrench size={18} /> Equipos necesarios
              </h2>

              {equipos.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No se han registrado equipos.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {equipos.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span>{q.nombre}</span>
                      <span className="flex items-center gap-2">
                        <Badge color="celeste">× {q.cantidad}</Badge>
                        {esStaff && (
                          <button
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() =>
                              exec(
                                supabase
                                  .from('event_equipment')
                                  .delete()
                                  .eq('id', q.id),
                                'Equipo eliminado.',
                              )
                            }
                            aria-label={`Quitar ${q.nombre}`}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {esStaff && (
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <Campo
                      label="Equipo"
                      placeholder="Ej.: Pantalla LED P3.9 (gabinetes)"
                      value={eqNombre}
                      onChange={(e) => setEqNombre(e.target.value)}
                    />
                  </div>
                  <div className="w-24">
                    <Campo
                      label="Cantidad"
                      type="number"
                      min={1}
                      value={eqCant}
                      onChange={(e) => setEqCant(e.target.value)}
                    />
                  </div>
                  <button className="btn-primary h-[42px]" onClick={agregarEquipo}>
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'montaje' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Base del montaje: <strong>{horaPeru(base)}</strong> (hora de citación)
              {finMontaje && (
                <>
                  {' '}· Fin estimado: <strong>{horaPeru(finMontaje)}</strong>
                  {' '}· Inicio del evento: <strong>{hhmm(evento.hora_inicio)}</strong>
                </>
              )}
            </div>
            {esStaff && (
              <button
                className="btn-primary"
                onClick={() => setTareaForm({ abierto: true, tarea: null })}
              >
                <Plus size={18} /> Nueva actividad
              </button>
            )}
          </div>

          {montajeTarde && (
            <Alerta tipo="error">
              <AlertTriangle className="mr-1 inline" size={16} />
              Con el plan actual el montaje termina a las {horaPeru(finMontaje!)},{' '}
              <strong>después</strong> del inicio del evento ({hhmm(evento.hora_inicio)}).
              Reduce duraciones, agrega personal o ejecuta más actividades en paralelo.
            </Alerta>
          )}

          {retrasadas.length > 0 && (
            <Alerta tipo="aviso">
              <strong>{retrasadas.length}</strong> actividad(es) con retraso:{' '}
              {retrasadas
                .map((p) => `${p.tarea.nombre} (+${fmtDuracion(p.retrasoMin)})`)
                .join(', ')}.
            </Alerta>
          )}

          {tareas.length === 0 ? (
            <div className="card">
              <Vacio texto="Aún no hay actividades de montaje para este evento." />
            </div>
          ) : (
            <>
              <Gantt planes={planes} nombreResp={nombreResp} />

              <div className="card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">Actividad</th>
                      <th className="th">Responsable</th>
                      <th className="th">Inicio</th>
                      <th className="th">Duración</th>
                      <th className="th">Fin estimado</th>
                      <th className="th">Tiempo real</th>
                      <th className="th">Estado</th>
                      <th className="th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {planes.map((p) => {
                      const t = p.tarea;
                      const puede = esStaff || t.responsable_id === profile?.id;
                      const deps = t.depende_de
                        .map((d) => tareas.find((x) => x.id === d)?.nombre)
                        .filter(Boolean);
                      const bloqueada = t.depende_de.some(
                        (d) => tareas.find((x) => x.id === d)?.estado !== 'completada',
                      );

                      return (
                        <tr
                          key={t.id}
                          className={
                            p.retrasada && t.estado !== 'completada'
                              ? 'bg-red-50/50'
                              : ''
                          }
                        >
                          <td className="td">
                            <p className="font-medium">{t.nombre}</p>
                            <p className="text-xs text-slate-500">
                              {CATEGORIAS[t.categoria]}
                              {deps.length
                                ? ` · después de: ${deps.join(', ')}`
                                : ' · en paralelo'}
                            </p>
                            {conflictos.has(t.id) && (
                              <p className="text-xs text-amber-700">
                                ⚠ Se cruza con otra actividad del mismo responsable
                              </p>
                            )}
                          </td>
                          <td className="td">{nombreResp(t.responsable_id)}</td>
                          <td className="td tabular-nums">{horaPeru(p.inicio)}</td>
                          <td className="td">{fmtDuracion(t.duracion_min)}</td>
                          <td className="td tabular-nums">{horaPeru(p.fin)}</td>
                          <td className="td">
                            {p.tiempoRealMin !== null ? (
                              <>
                                {fmtDuracion(p.tiempoRealMin)}
                                {t.estado === 'en_progreso' && (
                                  <span className="text-xs text-slate-500"> (en curso)</span>
                                )}
                              </>
                            ) : '–'}
                          </td>
                          <td className="td space-y-1">
                            {t.estado === 'completada' ? (
                              <Badge color={p.retrasoMin > 0 ? 'ambar' : 'verde'}>
                                Completada
                                {p.retrasoMin > 0 ? ` · +${fmtDuracion(p.retrasoMin)}` : ''}
                              </Badge>
                            ) : t.estado === 'en_progreso' ? (
                              <Badge color={p.retrasada ? 'rojo' : 'azul'}>
                                {p.retrasada
                                  ? `Retrasada +${fmtDuracion(p.retrasoMin)}`
                                  : 'En progreso'}
                              </Badge>
                            ) : (
                              <Badge
                                color={
                                  p.retrasada ? 'rojo' : p.inicioTardio ? 'ambar' : 'gris'
                                }
                              >
                                {p.retrasada
                                  ? `Retrasada +${fmtDuracion(p.retrasoMin)}`
                                  : p.inicioTardio ? 'Debió iniciar' : 'Pendiente'}
                              </Badge>
                            )}
                          </td>
                          <td className="td whitespace-nowrap text-right">
                            {puede && t.estado === 'pendiente' && (
                              <button
                                className="btn-primary btn-sm"
                                disabled={bloqueada}
                                title={bloqueada ? 'Hay actividades previas sin completar' : ''}
                                onClick={() => cambiarEstado(t, 'en_progreso')}
                              >
                                <Play size={13} /> Iniciar
                              </button>
                            )}
                            {puede && t.estado === 'en_progreso' && (
                              <button
                                className="btn-primary btn-sm !bg-emerald-600 hover:!bg-emerald-700"
                                onClick={() => cambiarEstado(t, 'completada')}
                              >
                                <CheckCheck size={13} /> Finalizar
                              </button>
                            )}
                            {esStaff && t.estado !== 'pendiente' && (
                              <button
                                className="btn-ghost btn-sm"
                                onClick={() => cambiarEstado(t, 'pendiente')}
                              >
                                Reiniciar
                              </button>
                            )}
                            {esStaff && (
                              <>
                                <button
                                  className="btn-ghost btn-sm"
                                  onClick={() => setTareaForm({ abierto: true, tarea: t })}
                                  aria-label="Editar"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  className="btn-ghost btn-sm !text-red-600"
                                  onClick={() => borrarTarea(t)}
                                  aria-label="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'asistencia' && esStaff && (
        <div className="card overflow-x-auto">
          {asist.length === 0 ? (
            <Vacio texto="Nadie ha registrado asistencia para este evento todavía." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Trabajador</th>
                  <th className="th">Entrada</th>
                  <th className="th">Salida</th>
                  <th className="th">Tardanza</th>
                  <th className="th">Estado</th>
                  <th className="th">Área</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {asist.map((a) => (
                  <tr key={a.id}>
                    <td className="td font-medium">{a.profiles?.nombres}</td>
                    <td className="td">{horaPeru(a.hora_entrada)}</td>
                    <td className="td">{horaPeru(a.hora_salida)}</td>
                    <td className="td">
                      {a.minutos_tardanza ? `${a.minutos_tardanza} min` : '–'}
                    </td>
                    <td className="td"><BadgeEstado e={a.estado} /></td>
                    <td className="td">
                      {a.hora_entrada
                        ? <BadgeArea dentro={a.entrada_dentro_area} dist={a.entrada_distancia_m} />
                        : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <EventForm
        abierto={editando}
        evento={evento}
        onCerrar={() => setEditando(false)}
        onGuardado={() => void cargar()}
      />

      <TaskForm
        abierto={tareaForm.abierto}
        eventId={evento.id}
        tarea={tareaForm.tarea}
        tareas={tareas}
        equipo={equipo}
        base={base}
        onCerrar={() => setTareaForm({ abierto: false, tarea: null })}
        onGuardado={() => void cargar()}
      />
    </>
  );
}
