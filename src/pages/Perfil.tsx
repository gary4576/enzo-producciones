import { useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Badge, Campo, Encabezado } from '../components/ui';
import { mensajeError, reCelular } from '../lib/validar';
import { ROLES } from '../lib/types';

export default function Perfil() {
  const { profile, recargarPerfil, cambiarPassword } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ nombres: '', celular: '', cargo: '', especialidad: '' });
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyP, setBusyP] = useState(false);

  useEffect(() => { if (profile) setF({ nombres: profile.nombres, celular: profile.celular, cargo: profile.cargo, especialidad: profile.especialidad ?? '' }); }, [profile]);
  if (!profile) return null;

  const guardar = async () => {
    if (f.nombres.trim().length < 3) { toast.error('Ingresa tus nombres completos.'); return; }
    if (!reCelular.test(f.celular)) { toast.error('El celular debe tener 9 dígitos y empezar con 9.'); return; }
    if (f.cargo.trim().length < 2) { toast.error('Indica tu cargo.'); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ nombres: f.nombres.trim(), celular: f.celular, cargo: f.cargo.trim(), especialidad: f.especialidad.trim() || null }).eq('id', profile.id);
    setBusy(false);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.ok('Perfil actualizado.'); await recargarPerfil();
  };

  const cambiar = async () => {
    if (p1.length < 8 || !/[A-Za-z]/.test(p1) || !/\d/.test(p1)) { toast.error('La contraseña debe tener mínimo 8 caracteres, con letras y números.'); return; }
    if (p1 !== p2) { toast.error('Las contraseñas no coinciden.'); return; }
    setBusyP(true);
    try { await cambiarPassword(p1); toast.ok('Contraseña actualizada.'); setP1(''); setP2(''); }
    catch (e) { toast.error(mensajeError(e)); }
    finally { setBusyP(false); }
  };

  return (
    <>
      <Encabezado titulo="Mi perfil" subtitulo="Tus datos personales y seguridad de la cuenta." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between"><h2 className="font-bold text-navy-900">Datos personales</h2><Badge color="azul">{ROLES[profile.rol]}</Badge></div>
          <Campo label="Nombres y apellidos" value={f.nombres} onChange={(e) => setF({ ...f, nombres: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2"><Campo label="DNI" value={profile.dni} disabled /><Campo label="Correo" value={profile.email} disabled /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Celular" inputMode="numeric" maxLength={9} value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value.replace(/\D/g, '') })} />
            <Campo label="Cargo" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} />
          </div>
          <Campo label="Especialidad" value={f.especialidad} onChange={(e) => setF({ ...f, especialidad: e.target.value })} />
          <button className="btn-primary" onClick={guardar} disabled={busy}><Save size={16} /> {busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </section>
        <section className="card h-fit space-y-4 p-5">
          <h2 className="font-bold text-navy-900">Cambiar contraseña</h2>
          <Campo label="Nueva contraseña" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} ayuda="Mínimo 8 caracteres, con letras y números." />
          <Campo label="Confirmar contraseña" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
          <button className="btn-secondary" onClick={cambiar} disabled={busyP}><KeyRound size={16} /> {busyP ? 'Actualizando…' : 'Actualizar contraseña'}</button>
        </section>
      </div>
    </>
  );
}
