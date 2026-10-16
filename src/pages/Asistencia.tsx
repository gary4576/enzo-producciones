
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlarmClock,
  CalendarX2,
  CalendarCheck,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Pencil,
  Map as MapIcon,
  UserX,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  Alerta,
  AreaTexto,
  Badge,
  Campo,
  Encabezado,
  Modal,
  Seleccion,
  Spinner,
  StatCard,
  Vacio,
} from '../components/ui';
import { MapView, type ObjetivoMapa, type PuntoMapa } from '../components/MapView';
import { obtenerPosicion, type Posicion } from '../lib/geo';
import {
  fmtFecha,
  hhmm,
  horaPeru,
  hoyPeru,
  mesPeru,
  peruADate,
  rangoMes,
  difMin,
} from '../lib/time';
import { mensajeError } from '../lib/validar';
import {
  ESTADOS_ASISTENCIA,
  type Asistencia,
  type Config,
  type EstadoAsistencia,
  type Profile,
} from '../lib/types';

interface EventoHoy {
  id: string;
  nombre: string;
  hora_citacion: string;
  lat: number | null;
  lng: number | null;
  radio_m: number;
  direccion: string;
  estado?: string;
}

const SELECT =
  '*, profiles:worker_id(nombres,dni), events:event_id(nombre,lat,lng,radio_m)';

export function BadgeEstado({ e }: { e: EstadoAsistencia }) {
  const c = {
    puntual: 'verde',
    tardanza: 'ambar',
    falta_justificada: 'azul',
    falta_injustificada: 'rojo',
  } as const;

  return <Badge color={c[e]}>{ESTADOS_ASISTENCIA[e]}</Badge>;
}

export function BadgeArea({
  dentro,
  dist,
}: {
  dentro: boolean | null;
  dist: number | null;
}) {
  if (dentro === null) return <Badge color="gris">Sin referencia</Badge>;

  return (
    <Badge color={dentro ? 'verde' : 'rojo'}>
      {dentro ? 'Dentro' : 'Fuera'} · {Math.round(dist ?? 0)} m
    </Badge>
  );
}

export default function Asistencia() {
  const { profile, esStaff } = useAuth();
  const toast = useToast();
  const hoy = hoyPeru();

  const [config, setConfig] = useState<Config | null>(null);
  const [eventosHoy, setEventosHoy] = useState<EventoHoy[]>([]);
  const [registrosHoy, setRegistrosHoy] = useState<Asistencia[]>([]);
  const [misMes, setMisMes] = useState<Asistencia[]>([]);
  const [cargando, setCargando] = useState(true);

  const [eventoSel, setEventoSel] = useState('');
  const [obs, setObs] = useState('');
  const [gps, setGps] = useState<Posicion | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [marcando, setMarcando] = useState(false);
  const [reloj, setReloj] = useState(new Date());

  const [vista, setVista] = useState<'mios' | 'todos'>('mios');
  const [mes, setMes] = useState(mesPeru());
  const [trabajadorF, setTrabajadorF] = useState('');
  const [trabajadores, setTrabajadores] = useState<Profile[]>([]);
  const [historial, setHistorial] = useState<Asistencia[]>([]);
  const [cargandoH, setCargandoH] = useState(false);

  const [mapaFila, setMapaFila] = useState<Asistencia | null>(null);
  const [editar, setEditar] = useState<Asistencia | null>(null);
  const [modalFalta, setModalFalta] = useState(false);
  const [modalGenerar, setModalGenerar] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const cargarBase = useCallback(async () => {
    if (!profile) return;

    setCargando(true);

    try {
      const { desde, hasta } = rangoMes(mesPeru());

      const [c, ev, rh, mm] = await Promise.all([
        supabase
          .from('config')
          .select('*')
          .eq('id', 1)
          .maybeSingle(),

        supabase
          .from('event_workers')
          .select(
            'events!inner(id,nombre,hora_citacion,lat,lng,radio_m,direccion,fecha,estado)',
          )
          .eq('worker_id', profile.id)
          .eq('events.fecha', hoy),

        // Cargar todas las asistencias del trabajador de hoy.
        supabase
          .from('attendance')
          .select(SELECT)
          .eq('worker_id', profile.id)
          .eq('fecha', hoy),

        supabase
          .from('attendance')
          .select('*')
          .eq('worker_id', profile.id)
          .gte('fecha', desde)
          .lte('fecha', hasta),
      ]);

      if (c.error) throw c.error;
      if (ev.error) throw ev.error;
      if (rh.error) throw rh.error;
      if (mm.error) throw mm.error;

      setConfig((c.data as Config) ?? null);

      const asistenciasHoy = (rh.data ?? []) as unknown as Asistencia[];
      setRegistrosHoy(asistenciasHoy);

      const listaCompleta = (
        (ev.data ?? []) as unknown as {
          events: EventoHoy & { estado: string };
        }[]
      )
        .map((r) => r.events)
        .filter((e) => e && e.estado !== 'cancelado');

      // Mantener eventos finalizados solo si falta registrar la salida.
      const lista = listaCompleta.filter(
        (e) =>
          e.estado !== 'finalizado' ||
          asistenciasHoy.some(
            (a) =>
              a.event_id === e.id &&
              Boolean(a.hora_entrada) &&
              !a.hora_salida,
          ),
      );

      // Evitar eventos duplicados en el selector.
      const eventosUnicos = Array.from(
        new Map(lista.map((e) => [e.id, e])).values(),
      );

      setEventosHoy(eventosUnicos);

      setEventoSel((actual) => {
        if (actual && eventosUnicos.some((e) => e.id === actual)) {
          return actual;
        }

        const eventosActivos = eventosUnicos.filter(
          (e) => e.estado !== 'finalizado',
        );

        if (eventosActivos.length === 1) {
          return eventosActivos[0].id;
        }

        if (eventosActivos.length > 1) {
          return '';
        }

        return eventosUnicos.length === 1 ? eventosUnicos[0].id : '';
      });

      setMisMes((mm.data as Asistencia[]) ?? []);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setCargando(false);
    }
  }, [profile, hoy, toast]);

  useEffect(() => {
    void cargarBase();
  }, [cargarBase]);

  useEffect(() => {
    const actualizarEventos = () => {
      void cargarBase();
    };

    window.addEventListener('focus', actualizarEventos);

    return () => {
      window.removeEventListener('focus', actualizarEventos);
    };
  }, [cargarBase]);

  useEffect(() => {
    if (!esStaff) return;

    supabase
      .from('profiles')
      .select('*')
      .eq('activo', true)
      .order('nombres')
      .then(({ data }) => setTrabajadores((data as Profile[]) ?? []));
  }, [esStaff]);

  const cargarHistorial = useCallback(async () => {
    if (!profile) return;

    setCargandoH(true);

    try {
      const { desde, hasta } = rangoMes(mes);

      let q = supabase
        .from('attendance')
        .select(SELECT)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false });

      if (vista === 'mios') {
        q = q.eq('worker_id', profile.id);
      } else if (trabajadorF) {
        q = q.eq('worker_id', trabajadorF);
      }

      const { data, error } = await q;

      if (error) throw error;

      setHistorial((data as Asistencia[]) ?? []);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setCargandoH(false);
    }
  }, [profile, mes, vista, trabajadorF, toast]);

  useEffect(() => {
    void cargarHistorial();
  }, [cargarHistorial]);

  const refrescar = async () => {
    await Promise.all([cargarBase(), cargarHistorial()]);
  };

  const evento = eventosHoy.find((e) => e.id === eventoSel) ?? null;

  // El registro se busca por evento, no solamente por trabajador y fecha.
  const registroHoy =
    registrosHoy.find((r) =>
      eventoSel ? r.event_id === eventoSel : !r.event_id,
    ) ?? null;

  const evRegistro = registroHoy?.event_id
    ? eventosHoy.find((e) => e.id === registroHoy.event_id) ?? null
    : null;

  const objetivo: ObjetivoMapa | null = useMemo(() => {
    const e = registroHoy ? evRegistro : evento;

    if (e && e.lat !== null && e.lng !== null) {
      return {
        lat: e.lat,
        lng: e.lng,
        radio: e.radio_m,
        etiqueta: e.nombre,
      };
    }

    if (
      !e &&
      config &&
      config.sede_lat !== null &&
      config.sede_lng !== null
    ) {
      return {
        lat: config.sede_lat,
        lng: config.sede_lng,
        radio: config.sede_radio_m,
        etiqueta: 'Sede de la empresa',
      };
    }

    return null;
  }, [registroHoy, evRegistro, evento, config]);

  const aviso = useMemo(() => {
    if (registroHoy || !config) return null;

    const prog = evento
      ? peruADate(hoy, evento.hora_citacion)
      : peruADate(hoy, config.hora_entrada);

    const min = difMin(reloj, prog);

    if (min > config.tolerancia_min) {
      return {
        tipo: 'aviso' as const,
        texto: `Hora programada ${hhmm(
          evento?.hora_citacion ?? config.hora_entrada,
        )}. Si marcas ahora se registrará una tardanza de ${min} min.`,
      };
    }

    return {
      tipo: 'ok' as const,
      texto: `Hora programada ${hhmm(
        evento?.hora_citacion ?? config.hora_entrada,
      )}. Estás a tiempo.`,
    };
  }, [registroHoy, config, evento, reloj, hoy]);

  const pedirGps = async () => {
    setGpsError('');

    try {
      setGps(await obtenerPosicion());
    } catch (e) {
      setGps(null);
      setGpsError(mensajeError(e));
    }
  };

  const marcar = async (tipo: 'entrada' | 'salida') => {
    if (marcando) return;

    if (tipo === 'salida' && !registroHoy) {
      toast.error('No hay una entrada registrada para este lugar.');
      return;
    }

    // Para la salida se usa el evento del registro que se está mostrando.
    // Para la entrada se usa el evento que eligió el trabajador.
    const eventId =
      tipo === 'salida'
        ? registroHoy?.event_id ?? null
        : eventoSel || null;

    setMarcando(true);
    setGpsError('');

    try {
      const pos = await obtenerPosicion();
      setGps(pos);

      const args = {
        p_lat: pos.lat,
        p_lng: pos.lng,
        p_precision: pos.precision,
        p_obs: obs.trim() || null,
      };

      const resultado =
        tipo === 'entrada'
          ? await supabase.rpc('marcar_entrada', {
              p_event_id: eventId,
              ...args,
            })
          : await supabase.rpc('marcar_salida', {
              p_event_id: eventId,
              ...args,
            });

      const { data, error } = resultado;

      if (error) throw error;

      if (!data) {
        throw new Error('No se recibió el registro de asistencia.');
      }

      const r = data as Asistencia;

      const dentro =
        tipo === 'entrada'
          ? r.entrada_dentro_area
          : r.salida_dentro_area;

      toast.ok(
        tipo === 'entrada'
          ? `Entrada registrada a las ${horaPeru(
              r.hora_entrada,
            )}${
              r.minutos_tardanza
                ? ` (tardanza de ${r.minutos_tardanza} min)`
                : ''
            }.`
          : `Salida registrada a las ${horaPeru(r.hora_salida)}.`,
      );

      if (dentro === false) {
        toast.error(
          'Estás FUERA del área autorizada. Tu supervisor podrá verlo.',
        );
      }

      setObs('');
      await refrescar();
    } catch (e) {
      const m = mensajeError(e);
      setGpsError(m);
      toast.error(m);
    } finally {
      setMarcando(false);
    }
  };

  const stats = useMemo(
    () => ({
      tard: misMes.filter((r) => r.estado === 'tardanza').length,
      faltas: misMes.filter((r) => r.estado.startsWith('falta')).length,
      asist: misMes.filter(
        (r) => r.estado === 'puntual' || r.estado === 'tardanza',
      ).length,
    }),
    [misMes],
  );

  if (cargando) return <Spinner />;

  const puedeEntrada = !registroHoy;
  const puedeSalida =
    !!registroHoy?.hora_entrada && !registroHoy.hora_salida;

  const posActual = gps
    ? [
        {
          lat: gps.lat,
          lng: gps.lng,
          etiqueta: 'Tu ubicación actual',
          color: '#1E6FE0',
        },
      ]
    : [];

  const puntosRegistro: PuntoMapa[] = [];

  if (
    registroHoy?.entrada_lat != null &&
    registroHoy.entrada_lng != null
  ) {
    puntosRegistro.push({
      lat: registroHoy.entrada_lat,
      lng: registroHoy.entrada_lng,
      etiqueta: 'Entrada',
      color:
        registroHoy.entrada_dentro_area === false ? '#dc2626' : '#16a34a',
    });
  }

  if (
    registroHoy?.salida_lat != null &&
    registroHoy.salida_lng != null
  ) {
    puntosRegistro.push({
      lat: registroHoy.salida_lat,
      lng: registroHoy.salida_lng,
      etiqueta: 'Salida',
      color: '#1E6FE0',
    });
  }

  return (
    <>
      <Encabezado
        titulo="Registro de asistencia"
        subtitulo="Marca tu entrada y salida con tu ubicación GPS. Hora oficial: Perú (UTC-5)."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icono={<CheckCircle2 />}
          color="bg-emerald-100 text-emerald-600"
          etiqueta="Hoy"
          valor={
            registroHoy?.hora_entrada
              ? horaPeru(registroHoy.hora_entrada)
              : '–'
          }
          detalle="Hora de ingreso"
        />
        <StatCard
          icono={<AlarmClock />}
          color="bg-red-100 text-red-500"
          etiqueta="Tardanzas"
          valor={stats.tard}
          detalle="este mes"
        />
        <StatCard
          icono={<CalendarX2 />}
          color="bg-sky-100 text-sky-600"
          etiqueta="Faltas"
          valor={stats.faltas}
          detalle="este mes"
        />
        <StatCard
          icono={<CalendarCheck />}
          color="bg-indigo-100 text-indigo-600"
          etiqueta="Total de asistencias"
          valor={stats.asist}
          detalle="este mes"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-900">
              Marcar asistencia
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1 text-sm font-semibold tabular-nums text-white">
              <Clock size={14} />
              {new Intl.DateTimeFormat('es-PE', {
                timeZone: 'America/Lima',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }).format(reloj)}
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-500">{fmtFecha(hoy)}</p>

          {registroHoy && registroHoy.estado.startsWith('falta') ? (
            <div className="mt-4">
              <Alerta tipo="aviso">
                Hoy tienes registrada una{' '}
                <strong>
                  {ESTADOS_ASISTENCIA[registroHoy.estado].toLowerCase()}
                </strong>
                . Si es un error, habla con tu supervisor.
              </Alerta>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* El selector permanece visible para cambiar de evento. */}
              <Seleccion
                label="Lugar de trabajo de hoy"
                value={eventoSel}
                onChange={(e) => {
                  setEventoSel(e.target.value);
                  setGpsError('');
                  setGps(null);
                }}
              >
                <option value="">Jornada en la sede de la empresa</option>
                {eventosHoy.map((e) => (
                  <option key={e.id} value={e.id}>
                    Evento: {e.nombre} (citación {hhmm(e.hora_citacion)})
                  </option>
                ))}
              </Seleccion>

              {registroHoy && (
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p>
                    <strong>Lugar:</strong>{' '}
                    {registroHoy.events?.nombre ??
                      evento?.nombre ??
                      'Sede de la empresa'}
                  </p>
                  <p>
                    <strong>Entrada:</strong>{' '}
                    {horaPeru(registroHoy.hora_entrada)}{' '}
                    <BadgeEstado e={registroHoy.estado} />
                    {registroHoy.minutos_tardanza > 0 && (
                      <span className="ml-1 text-amber-700">
                        ({registroHoy.minutos_tardanza} min de tardanza)
                      </span>
                    )}
                  </p>
                  <p className="mt-1">
                    <strong>Área:</strong>{' '}
                    <BadgeArea
                      dentro={registroHoy.entrada_dentro_area}
                      dist={registroHoy.entrada_distancia_m}
                    />
                  </p>
                  {registroHoy.hora_salida && (
                    <p className="mt-1">
                      <strong>Salida:</strong>{' '}
                      {horaPeru(registroHoy.hora_salida)}{' '}
                      <BadgeArea
                        dentro={registroHoy.salida_dentro_area}
                        dist={registroHoy.salida_distancia_m}
                      />
                    </p>
                  )}
                </div>
              )}

              {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}

              {(puedeEntrada || puedeSalida) && (
                <AreaTexto
                  label="Observaciones (opcional)"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Puedes agregar alguna nota…"
                  maxLength={300}
                />
              )}

              {gpsError && <Alerta tipo="error">{gpsError}</Alerta>}

              {gps && (
                <p className="text-xs text-slate-500">
                  GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} (±
                  {Math.round(gps.precision)} m)
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {puedeEntrada && (
                  <button
                    className="btn-primary flex-1"
                    disabled={marcando}
                    onClick={() => marcar('entrada')}
                  >
                    <LogIn size={18} />
                    {marcando ? 'Obteniendo GPS…' : 'Marcar entrada'}
                  </button>
                )}

                {puedeSalida && (
                  <button
                    className="btn-primary flex-1 !bg-navy-800 hover:!bg-navy-700"
                    disabled={marcando}
                    onClick={() => marcar('salida')}
                  >
                    <LogOut size={18} />
                    {marcando ? 'Obteniendo GPS…' : 'Marcar salida'}
                  </button>
                )}

                <button
                  className="btn-secondary"
                  onClick={pedirGps}
                  disabled={marcando}
                >
                  <Navigation size={16} /> Ver mi ubicación
                </button>
              </div>

              {registroHoy?.hora_salida && (
                <Alerta tipo="ok">
                  La asistencia de este lugar está completa. Puedes seleccionar
                  otro evento para consultar o registrar su asistencia.
                </Alerta>
              )}
            </div>
          )}
        </section>

        <section className="card p-5 xl:col-span-3">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-navy-900">
            <MapPin size={18} /> Área autorizada
          </h2>
          {objetivo ? (
            <>
              <MapView
                objetivo={objetivo}
                puntos={[...puntosRegistro, ...posActual]}
                altura={320}
              />
              <p className="mt-2 text-xs text-slate-500">
                {objetivo.etiqueta} · radio permitido {objetivo.radio} m.
                Punto verde = dentro, rojo = fuera, azul = ubicación actual.
              </p>
            </>
          ) : (
            <Alerta tipo="aviso">
              Este lugar aún no tiene ubicación configurada, por eso no se puede
              validar el área.{' '}
              {esStaff
                ? 'Configúrala en Eventos o Configuración.'
                : 'Avisa a tu supervisor.'}
            </Alerta>
          )}
        </section>
      </div>

      <section className="card mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold text-navy-900">
            Historial de asistencias
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            {esStaff && (
              <>
                <Seleccion
                  label="Ver"
                  value={vista}
                  onChange={(e) =>
                    setVista(e.target.value as 'mios' | 'todos')
                  }
                >
                  <option value="mios">Mis registros</option>
                  <option value="todos">Todos los trabajadores</option>
                </Seleccion>
                {vista === 'todos' && (
                  <Seleccion
                    label="Trabajador"
                    value={trabajadorF}
                    onChange={(e) => setTrabajadorF(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {trabajadores.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombres}
                      </option>
                    ))}
                  </Seleccion>
                )}
              </>
            )}
            <Campo
              label="Mes"
              type="month"
              value={mes}
              max={mesPeru()}
              onChange={(e) => e.target.value && setMes(e.target.value)}
            />
          </div>
        </div>

        {esStaff && (
          <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <button
              className="btn-secondary btn-sm"
              onClick={() => setModalFalta(true)}
            >
              <UserX size={14} /> Registrar falta
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setModalGenerar(true)}
            >
              <CalendarX2 size={14} /> Marcar faltas de un día
            </button>
          </div>
        )}

        {cargandoH ? (
          <Spinner />
        ) : historial.length === 0 ? (
          <Vacio texto="No hay registros de asistencia en este período." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {vista === 'todos' && <th className="th">Trabajador</th>}
                  <th className="th">Fecha</th>
                  <th className="th">Lugar</th>
                  <th className="th">Entrada</th>
                  <th className="th">Salida</th>
                  <th className="th">Tardanza</th>
                  <th className="th">Estado</th>
                  <th className="th">Área</th>
                  <th className="th">Observaciones</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    {vista === 'todos' && (
                      <td className="td font-medium">
                        {r.profiles?.nombres}
                      </td>
                    )}
                    <td className="td">{fmtFecha(r.fecha)}</td>
                    <td className="td">
                      {r.events?.nombre ??
                        (r.event_id ? 'Evento' : r.hora_entrada ? 'Sede' : '–')}
                    </td>
                    <td className="td tabular-nums">
                      {horaPeru(r.hora_entrada)}
                    </td>
                    <td className="td tabular-nums">
                      {horaPeru(r.hora_salida)}
                    </td>
                    <td className="td">
                      {r.minutos_tardanza > 0
                        ? `${r.minutos_tardanza} min`
                        : '–'}
                    </td>
                    <td className="td">
                      <BadgeEstado e={r.estado} />
                    </td>
                    <td className="td">
                      {r.hora_entrada ? (
                        <BadgeArea
                          dentro={r.entrada_dentro_area}
                          dist={r.entrada_distancia_m}
                        />
                      ) : (
                        '–'
                      )}
                    </td>
                    <td className="td max-w-[14rem] text-slate-600">
                      {[
                        r.observaciones,
                        r.justificacion &&
                          `Justificación: ${r.justificacion}`,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '–'}
                    </td>
                    <td className="td whitespace-nowrap text-right">
                      {r.entrada_lat !== null && (
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => setMapaFila(r)}
                          title="Ver en mapa"
                        >
                          <MapIcon size={14} /> Mapa
                        </button>
                      )}
                      {esStaff && (
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => setEditar(r)}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ModalMapa
        fila={mapaFila}
        config={config}
        onCerrar={() => setMapaFila(null)}
      />
      <ModalEditar
        fila={editar}
        onCerrar={() => setEditar(null)}
        onGuardado={refrescar}
      />
      <ModalFalta
        abierto={modalFalta}
        trabajadores={trabajadores}
        onCerrar={() => setModalFalta(false)}
        onGuardado={refrescar}
      />
      <ModalGenerar
        abierto={modalGenerar}
        onCerrar={() => setModalGenerar(false)}
        onGuardado={refrescar}
      />
    </>
  );
}

function ModalMapa({
  fila,
  config,
  onCerrar,
}: {
  fila: Asistencia | null;
  config: Config | null;
  onCerrar: () => void;
}) {
  if (!fila) return null;

  let objetivo: ObjetivoMapa | null = null;

  if (
    fila.events &&
    fila.events.lat !== null &&
    fila.events.lng !== null
  ) {
    objetivo = {
      lat: fila.events.lat,
      lng: fila.events.lng,
      radio: fila.events.radio_m,
      etiqueta: fila.events.nombre,
    };
  } else if (
    !fila.event_id &&
    config &&
    config.sede_lat !== null &&
    config.sede_lng !== null
  ) {
    objetivo = {
      lat: config.sede_lat,
      lng: config.sede_lng,
      radio: config.sede_radio_m,
      etiqueta: 'Sede de la empresa',
    };
  }

  const puntos: PuntoMapa[] = [];

  if (fila.entrada_lat !== null && fila.entrada_lng !== null) {
    puntos.push({
      lat: fila.entrada_lat,
      lng: fila.entrada_lng,
      etiqueta: `Entrada ${horaPeru(fila.hora_entrada)}`,
      color: fila.entrada_dentro_area === false ? '#dc2626' : '#16a34a',
    });
  }

  if (fila.salida_lat !== null && fila.salida_lng !== null) {
    puntos.push({
      lat: fila.salida_lat,
      lng: fila.salida_lng,
      etiqueta: `Salida ${horaPeru(fila.hora_salida)}`,
      color: '#1E6FE0',
    });
  }

  return (
    <Modal
      abierto
      titulo={`Ubicación · ${fila.profiles?.nombres ?? 'Mi registro'} · ${fmtFecha(fila.fecha)}`}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      <MapView objetivo={objetivo} puntos={puntos} altura={380} />
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <span>
          Entrada:{' '}
          <BadgeArea
            dentro={fila.entrada_dentro_area}
            dist={fila.entrada_distancia_m}
          />
        </span>
        {fila.hora_salida && (
          <span>
            Salida:{' '}
            <BadgeArea
              dentro={fila.salida_dentro_area}
              dist={fila.salida_distancia_m}
            />
          </span>
        )}
      </div>
      {!objetivo && (
        <div className="mt-3">
          <Alerta tipo="aviso">
            El lugar no tiene ubicación configurada; solo se muestran los
            puntos de marcación.
          </Alerta>
        </div>
      )}
    </Modal>
  );
}

function ModalEditar({
  fila,
  onCerrar,
  onGuardado,
}: {
  fila: Asistencia | null;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoAsistencia>(
    'falta_injustificada',
  );
  const [just, setJust] = useState('');
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (fila) {
      setEstado(fila.estado);
      setJust(fila.justificacion ?? '');
      setObs(fila.observaciones ?? '');
    }
  }, [fila]);

  if (!fila) return null;

  const esFalta = fila.estado.startsWith('falta');

  const guardar = async () => {
    if (estado === 'falta_justificada' && just.trim().length < 3) {
      toast.error('Escribe la justificación de la falta.');
      return;
    }

    setBusy(true);

    const cambios: Partial<Asistencia> = {
      observaciones: obs.trim() || null,
      justificacion: just.trim() || null,
    };

    if (esFalta) cambios.estado = estado;

    const { error } = await supabase
      .from('attendance')
      .update(cambios)
      .eq('id', fila.id);

    setBusy(false);

    if (error) {
      toast.error(mensajeError(error));
      return;
    }

    toast.ok('Registro actualizado.');
    await onGuardado();
    onCerrar();
  };

  return (
    <Modal
      abierto
      titulo={`Editar registro · ${fila.profiles?.nombres ?? ''} · ${fmtFecha(fila.fecha)}`}
      onCerrar={onCerrar}
      ancho="max-w-lg"
    >
      <div className="space-y-4">
        {esFalta && (
          <Seleccion
            label="Tipo de falta"
            value={estado}
            onChange={(e) =>
              setEstado(e.target.value as EstadoAsistencia)
            }
          >
            <option value="falta_injustificada">
              Falta injustificada
            </option>
            <option value="falta_justificada">Falta justificada</option>
          </Seleccion>
        )}
        <AreaTexto
          label="Justificación"
          value={just}
          onChange={(e) => setJust(e.target.value)}
        />
        <AreaTexto
          label="Observaciones"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={guardar}
          >
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalFalta({
  abierto,
  trabajadores,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  trabajadores: Profile[];
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const toast = useToast();
  const [w, setW] = useState('');
  const [fecha, setFecha] = useState(hoyPeru());
  const [tipo, setTipo] = useState<
    'falta_justificada' | 'falta_injustificada'
  >('falta_injustificada');
  const [just, setJust] = useState('');
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    if (!w) {
      toast.error('Selecciona un trabajador.');
      return;
    }

    if (!fecha || fecha > hoyPeru()) {
      toast.error('La fecha no puede ser futura.');
      return;
    }

    if (tipo === 'falta_justificada' && just.trim().length < 3) {
      toast.error('Escribe la justificación.');
      return;
    }

    setBusy(true);

    const { error } = await supabase.from('attendance').insert({
      worker_id: w,
      fecha,
      estado: tipo,
      justificacion: just.trim() || null,
      observaciones: obs.trim() || null,
    });

    setBusy(false);

    if (error) {
      toast.error(mensajeError(error));
      return;
    }

    toast.ok('Falta registrada.');
    setW('');
    setJust('');
    setObs('');
    await onGuardado();
    onCerrar();
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Registrar falta"
      onCerrar={onCerrar}
      ancho="max-w-lg"
    >
      <div className="space-y-4">
        <Seleccion
          label="Trabajador"
          value={w}
          onChange={(e) => setW(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {trabajadores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombres} · DNI {t.dni}
            </option>
          ))}
        </Seleccion>
        <Campo
          label="Fecha"
          type="date"
          value={fecha}
          max={hoyPeru()}
          onChange={(e) => setFecha(e.target.value)}
        />
        <Seleccion
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
        >
          <option value="falta_injustificada">Falta injustificada</option>
          <option value="falta_justificada">Falta justificada</option>
        </Seleccion>
        <AreaTexto
          label={
            tipo === 'falta_justificada'
              ? 'Justificación'
              : 'Justificación (opcional)'
          }
          value={just}
          onChange={(e) => setJust(e.target.value)}
        />
        <AreaTexto
          label="Observaciones (opcional)"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={guardar}
          >
            {busy ? 'Guardando…' : 'Registrar falta'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalGenerar({
  abierto,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
}) {
  const toast = useToast();
  const [fecha, setFecha] = useState(hoyPeru());
  const [busy, setBusy] = useState(false);

  const generar = async () => {
    setBusy(true);

    const { data, error } = await supabase.rpc('marcar_faltas', {
      p_fecha: fecha,
    });

    setBusy(false);

    if (error) {
      toast.error(mensajeError(error));
      return;
    }

    toast.ok(`${data as number} falta(s) injustificada(s) generada(s).`);
    await onGuardado();
    onCerrar();
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Marcar faltas de un día"
      onCerrar={onCerrar}
      ancho="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Registra como <strong>falta injustificada</strong> a los trabajadores
          asignados a eventos de esa fecha que no marcaron asistencia. Luego
          puedes justificarlas desde el historial.
        </p>
        <Campo
          label="Fecha"
          type="date"
          value={fecha}
          max={hoyPeru()}
          onChange={(e) => setFecha(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={generar}
          >
            {busy ? 'Procesando…' : 'Marcar faltas'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

