import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Alerta, Badge, Campo, Encabezado, Modal, Seleccion, Spinner, Vacio } from '../components/ui';
import { BadgeEvento } from './Eventos';
import { BadgeEstado } from './Asistencia';
import { fmtDuracion, fmtFecha, mesPeru, rangoMes } from '../lib/time';
import { mensajeError, reCelular } from '../lib/validar';
import { ROLES, type Asistencia, type Evento, type Profile, type Rol, type Tarea } from '../lib/types';

export default function Trabajadores() {
  const { profile: yo, esAdmin } = useAuth();
  const toast = useToast();
  const [lista, setLista] = useState<Profile[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [ver, setVer] = useState<Profile | null>(null);
  const [editar, setEditar] = useState<Profile | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('nombres');
    if (error) toast.error(mensajeError(error));
    setLista((data as Profile[]) ?? []); setCargando(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, [cargar]);

  const filtrada = useMemo(() => lista.filter((p) => (!rol || p.rol === rol) && (!q || `${p.nombres} ${p.dni} ${p.cargo} ${p.especialidad ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [lista, q, rol]);

  return (
    <>
      <Encabezado titulo="Trabajadores" subtitulo={esAdmin ? 'Administra el personal, cargos, especialidades y roles.' : 'Consulta del personal. Solo un administrador puede modificar datos.'} />
      <div className="card mb-5 grid gap-4 p-4 sm:grid-cols-2">
        <div className="relative"><Campo label="Buscar" placeholder="Nombre, DNI, cargo o especialidad" value={q} onChange={(e) => setQ(e.target.value)} /><Search size={16} className="pointer-events-none absolute bottom-3 right-3 text-slate-400" /></div>
        <Seleccion label="Rol" value={rol} onChange={(e) => setRol(e.target.value)}><option value="">Todos</option>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Seleccion>
      </div>
      {cargando ? <Spinner /> : filtrada.length === 0 ? <div className="card"><Vacio texto="No se encontraron trabajadores." /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Nombre</th><th className="th">DNI</th><th className="th">Celular</th><th className="th">Cargo</th><th className="th">Especialidad</th><th className="th">Rol</th><th className="th">Estado</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtrada.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="td"><p className="font-medium">{p.nombres}</p><p className="text-xs text-slate-500">{p.email}</p></td>
                  <td className="td">{p.dni}</td><td className="td">{p.celular}</td><td className="td">{p.cargo}</td><td className="td">{p.especialidad ?? '–'}</td>
                  <td className="td"><Badge color={p.rol === 'administrador' ? 'azul' : p.rol === 'supervisor' ? 'celeste' : 'gris'}>{ROLES[p.rol]}</Badge></td>
                  <td className="td"><Badge color={p.activo ? 'verde' : 'rojo'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="td whitespace-nowrap text-right">
                    <button className="btn-ghost btn-sm" onClick={() => setVer(p)}><Eye size={14} /> Ficha</button>
                    {esAdmin && <button className="btn-ghost btn-sm" onClick={() => setEditar(p)}><Pencil size={14} /> Editar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Ficha p={ver} onCerrar={() => setVer(null)} />
      <Edicion p={editar} esYo={editar?.id === yo?.id} onCerrar={() => setEditar(null)} onGuardado={cargar} />
    </>
  );
}

function Ficha({ p, onCerrar }: { p: Profile | null; onCerrar: () => void }) {
  const [datos, setDatos] = useState<{ eventos: Evento[]; asist: Asistencia[]; tareas: (Tarea & { events: { nombre: string } })[] } | null>(null);
  useEffect(() => {
    if (!p) return;
    setDatos(null);
    const { desde, hasta } = rangoMes(mesPeru());
    Promise.all([
      supabase.from('event_workers').select('events(*)').eq('worker_id', p.id),
      supabase.from('attendance').select('*').eq('worker_id', p.id).gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }),
      supabase.from('tasks').select('*, events(nombre)').eq('responsable_id', p.id).neq('estado', 'completada'),
    ]).then(([e, a, t]) => setDatos({
      eventos: ((e.data ?? []) as unknown as { events: Evento }[]).map((x) => x.events).sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, 8),
      asist: (a.data as Asistencia[]) ?? [], tareas: (t.data as unknown as (Tarea & { events: { nombre: string } })[]) ?? [],
    }));
  }, [p]);
  if (!p) return null;
  return (
    <Modal abierto titulo={p.nombres} onCerrar={onCerrar} ancho="max-w-3xl">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p><strong>DNI:</strong> {p.dni}</p><p><strong>Celular:</strong> {p.celular}</p><p><strong>Correo:</strong> {p.email}</p>
        <p><strong>Cargo:</strong> {p.cargo}</p><p><strong>Especialidad:</strong> {p.especialidad ?? '–'}</p><p><strong>Rol:</strong> {ROLES[p.rol]}</p>
      </div>
      {!datos ? <Spinner /> : (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-emerald-50 p-3"><p className="text-2xl font-bold text-emerald-700">{datos.asist.filter((a) => a.estado === 'puntual' || a.estado === 'tardanza').length}</p>Asistencias (mes)</div>
            <div className="rounded-lg bg-amber-50 p-3"><p className="text-2xl font-bold text-amber-700">{datos.asist.filter((a) => a.estado === 'tardanza').length}</p>Tardanzas (mes)</div>
            <div className="rounded-lg bg-red-50 p-3"><p className="text-2xl font-bold text-red-700">{datos.asist.filter((a) => a.estado.startsWith('falta')).length}</p>Faltas (mes)</div>
          </div>
          <div><h3 className="mb-2 font-semibold text-navy-900">Últimas asistencias</h3>
            {datos.asist.length === 0 ? <p className="text-sm text-slate-500">Sin registros este mes.</p> : <ul className="divide-y divide-slate-100 text-sm">{datos.asist.slice(0, 6).map((a) => <li key={a.id} className="flex justify-between py-1.5"><span>{fmtFecha(a.fecha)}</span><span className="flex items-center gap-2">{a.minutos_tardanza > 0 && <span className="text-xs text-slate-500">{a.minutos_tardanza} min</span>}<BadgeEstado e={a.estado} /></span></li>)}</ul>}</div>
          <div><h3 className="mb-2 font-semibold text-navy-900">Eventos asignados</h3>
            {datos.eventos.length === 0 ? <p className="text-sm text-slate-500">Sin eventos asignados.</p> : <ul className="divide-y divide-slate-100 text-sm">{datos.eventos.map((e) => <li key={e.id} className="flex items-center justify-between py-1.5"><Link className="text-brand hover:underline" to={`/app/eventos/${e.id}`}>{e.nombre}</Link><span className="flex items-center gap-2 text-xs text-slate-500">{fmtFecha(e.fecha)} <BadgeEvento e={e.estado} /></span></li>)}</ul>}</div>
          <div><h3 className="mb-2 font-semibold text-navy-900">Actividades pendientes</h3>
            {datos.tareas.length === 0 ? <p className="text-sm text-slate-500">Sin actividades pendientes.</p> : <ul className="divide-y divide-slate-100 text-sm">{datos.tareas.map((t) => <li key={t.id} className="flex justify-between py-1.5"><span>{t.nombre} <span className="text-slate-500">· {t.events.nombre}</span></span><span className="text-xs text-slate-500">{fmtDuracion(t.duracion_min)}</span></li>)}</ul>}</div>
        </div>
      )}
    </Modal>
  );
}

function Edicion({ p, esYo, onCerrar, onGuardado }: { p: Profile | null; esYo: boolean; onCerrar: () => void; onGuardado: () => Promise<void> }) {
  const toast = useToast();
  const [f, setF] = useState({ cargo: '', especialidad: '', celular: '', rol: 'trabajador' as Rol, activo: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (p) setF({ cargo: p.cargo, especialidad: p.especialidad ?? '', celular: p.celular, rol: p.rol, activo: p.activo }); }, [p]);
  if (!p) return null;
  const guardar = async () => {
    if (f.cargo.trim().length < 2) { toast.error('Indica el cargo.'); return; }
    if (!reCelular.test(f.celular)) { toast.error('El celular debe tener 9 dígitos y empezar con 9.'); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ cargo: f.cargo.trim(), especialidad: f.especialidad.trim() || null, celular: f.celular, rol: f.rol, activo: f.activo }).eq('id', p.id);
    setBusy(false);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.ok('Datos del trabajador actualizados.'); await onGuardado(); onCerrar();
  };
  return (
    <Modal abierto titulo={`Editar · ${p.nombres}`} onCerrar={onCerrar} ancho="max-w-lg">
      <div className="space-y-4">
        {esYo && <Alerta tipo="aviso">Estás editando tu propia cuenta: no puedes cambiar tu rol ni desactivarte.</Alerta>}
        <Campo label="Cargo" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} />
        <Campo label="Especialidad" placeholder="Ej.: Pantallas LED, sonido, rigging…" value={f.especialidad} onChange={(e) => setF({ ...f, especialidad: e.target.value })} />
        <Campo label="Celular" inputMode="numeric" maxLength={9} value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value.replace(/\D/g, '') })} />
        <Seleccion label="Rol" value={f.rol} disabled={esYo} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Seleccion>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activo} disabled={esYo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Cuenta activa (puede ingresar al sistema)</label>
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onCerrar}>Cancelar</button><button className="btn-primary" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </div>
    </Modal>
  );
}
