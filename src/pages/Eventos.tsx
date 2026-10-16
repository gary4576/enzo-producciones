import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, MapPin, Clock, Search, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Badge, Campo, Encabezado, Seleccion, Spinner, Vacio } from '../components/ui';
import { EventForm } from '../components/EventForm';
import { fmtFecha, hhmm, hoyPeru } from '../lib/time';
import { mensajeError } from '../lib/validar';
import { ESTADOS_EVENTO, type Evento, type EstadoEvento } from '../lib/types';

export function BadgeEvento({ e }: { e: EstadoEvento }) {
  const c = { programado: 'azul', en_montaje: 'ambar', en_curso: 'celeste', finalizado: 'verde', cancelado: 'gris' } as const;
  return <Badge color={c[e]}>{ESTADOS_EVENTO[e]}</Badge>;
}

export default function Eventos() {
  const { esStaff } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [periodo, setPeriodo] = useState<'proximos' | 'pasados' | 'todos'>('proximos');
  const [modal, setModal] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await supabase.from('events').select('*').order('fecha', { ascending: false }).order('hora_citacion');
    if (error) toast.error(mensajeError(error));
    setEventos((data as Evento[]) ?? []);
    setCargando(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, [cargar]);

  const hoy = hoyPeru();
  const lista = useMemo(() => eventos
    .filter((e) => (periodo === 'proximos' ? e.fecha >= hoy : periodo === 'pasados' ? e.fecha < hoy : true))
    .filter((e) => !estado || e.estado === estado)
    .filter((e) => !q || `${e.nombre} ${e.cliente} ${e.direccion}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (periodo === 'pasados' ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha)) || a.hora_citacion.localeCompare(b.hora_citacion)),
  [eventos, periodo, estado, q, hoy]);

  return (
    <>
      <Encabezado titulo="Eventos" subtitulo={esStaff ? 'Programa y consulta los eventos de la empresa.' : 'Eventos a los que estás asignado.'}>
        {esStaff && <button className="btn-primary" onClick={() => setModal(true)}><CalendarPlus size={18} /> Nuevo evento</button>}
      </Encabezado>

      <div className="card mb-5 grid gap-4 p-4 sm:grid-cols-3">
        <div className="relative">
          <Campo label="Buscar" placeholder="Nombre, cliente o dirección" value={q} onChange={(e) => setQ(e.target.value)} />
          <Search size={16} className="pointer-events-none absolute bottom-3 right-3 text-slate-400" />
        </div>
        <Seleccion label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)}>
          <option value="proximos">Próximos y de hoy</option><option value="pasados">Pasados</option><option value="todos">Todos</option>
        </Seleccion>
        <Seleccion label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>{Object.entries(ESTADOS_EVENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Seleccion>
      </div>

      {cargando ? <Spinner /> : lista.length === 0 ? (
        <div className="card"><Vacio texto={esStaff ? 'No hay eventos con estos filtros.' : 'No tienes eventos asignados con estos filtros.'}>
          {esStaff && <button className="btn-primary btn-sm" onClick={() => setModal(true)}>Crear evento</button>}
        </Vacio></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((e) => (
            <Link key={e.id} to={`/app/eventos/${e.id}`} className="card group flex flex-col gap-3 p-5 transition hover:border-brand">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="truncate font-bold text-navy-900">{e.nombre}</h3><p className="truncate text-sm text-slate-500">{e.cliente}</p></div>
                <BadgeEvento e={e.estado} />
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p className="flex items-center gap-2"><Clock size={15} className="text-brand" />{fmtFecha(e.fecha)} · citación {hhmm(e.hora_citacion)} · {hhmm(e.hora_inicio)}–{hhmm(e.hora_fin)}</p>
                <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-brand" /><span className="line-clamp-2">{e.direccion}</span></p>
              </div>
              <span className="mt-auto flex items-center gap-1 text-sm font-semibold text-brand">Ver detalle <ChevronRight size={16} className="transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      )}

      <EventForm abierto={modal} evento={null} onCerrar={() => setModal(false)} onGuardado={(id) => nav(`/app/eventos/${id}`)} />
    </>
  );
}
