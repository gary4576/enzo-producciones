import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Alerta, Campo, Encabezado, Spinner } from '../components/ui';
import { MapView } from '../components/MapView';
import { hhmm } from '../lib/time';
import { mensajeError } from '../lib/validar';
import type { Config } from '../lib/types';

export default function Configuracion() {
  const toast = useToast();
  const [c, setC] = useState<Config | null>(null);
  const [f, setF] = useState({ hora_entrada: '', hora_salida: '', tolerancia_min: '5', sede_radio_m: '100' });
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('config').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      const x = data as Config | null;
      if (!x) return;
      setC(x);
      setF({ hora_entrada: hhmm(x.hora_entrada), hora_salida: hhmm(x.hora_salida), tolerancia_min: String(x.tolerancia_min), sede_radio_m: String(x.sede_radio_m) });
      setLat(x.sede_lat); setLng(x.sede_lng);
    });
  }, []);

  if (!c) return <Spinner />;

  const guardar = async () => {
    const tol = Number(f.tolerancia_min), radio = Number(f.sede_radio_m);
    if (!f.hora_entrada || !f.hora_salida || f.hora_salida <= f.hora_entrada) { toast.error('La hora de salida debe ser posterior a la de entrada.'); return; }
    if (!Number.isInteger(tol) || tol < 0 || tol > 120) { toast.error('La tolerancia debe estar entre 0 y 120 minutos.'); return; }
    if (!Number.isInteger(radio) || radio < 10 || radio > 5000) { toast.error('El radio debe estar entre 10 y 5000 metros.'); return; }
    setBusy(true);
    const { error } = await supabase.from('config').update({ hora_entrada: f.hora_entrada, hora_salida: f.hora_salida, tolerancia_min: tol, sede_radio_m: radio, sede_lat: lat, sede_lng: lng }).eq('id', 1);
    setBusy(false);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.ok('Configuración guardada.');
  };

  return (
    <>
      <Encabezado titulo="Configuración" subtitulo="Horario general y ubicación de la sede, usados cuando no hay un evento asignado." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold text-navy-900">Jornada en sede</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Hora de entrada" type="time" value={f.hora_entrada} onChange={(e) => setF({ ...f, hora_entrada: e.target.value })} />
            <Campo label="Hora de salida" type="time" value={f.hora_salida} onChange={(e) => setF({ ...f, hora_salida: e.target.value })} />
          </div>
          <Campo label="Tolerancia (minutos)" type="number" min={0} value={f.tolerancia_min} onChange={(e) => setF({ ...f, tolerancia_min: e.target.value })} ayuda="Pasada la tolerancia se registra tardanza con todos los minutos de retraso. Aplica también a eventos." />
          <Campo label="Radio permitido en sede (metros)" type="number" min={10} value={f.sede_radio_m} onChange={(e) => setF({ ...f, sede_radio_m: e.target.value })} />
          <button className="btn-primary" disabled={busy} onClick={guardar}><Save size={16} /> {busy ? 'Guardando…' : 'Guardar configuración'}</button>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold text-navy-900">Ubicación de la sede</h2>
          {lat === null && <Alerta tipo="aviso">Sin ubicación configurada: las marcaciones en sede no mostrarán si están dentro o fuera del área. Haz clic en el mapa para fijarla.</Alerta>}
          <MapView objetivo={lat !== null && lng !== null ? { lat, lng, radio: Number(f.sede_radio_m) || 100, etiqueta: 'Sede de la empresa' } : null} onPick={(a, b) => { setLat(a); setLng(b); }} altura={340} />
          <p className="text-xs text-slate-500">{lat !== null && lng !== null ? `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Haz clic en el mapa para marcar la sede.'}</p>
        </section>
      </div>
    </>
  );
}
