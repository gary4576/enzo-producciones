import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { Alerta, Campo, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { mensajeError } from '../lib/validar';

export default function Restablecer() {
  const { session, cargando, cambiarPassword } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (p1.length < 8 || !/[A-Za-z]/.test(p1) || !/\d/.test(p1)) { setError('Mínimo 8 caracteres, con letras y números.'); return; }
    if (p1 !== p2) { setError('Las contraseñas no coinciden.'); return; }
    setError(''); setEnviando(true);
    try { await cambiarPassword(p1); toast.ok('Contraseña actualizada.'); nav('/app', { replace: true }); }
    catch (err) { setError(mensajeError(err)); }
    finally { setEnviando(false); }
  };

  if (cargando) return <Spinner />;
  return (
    <AuthShell titulo="Nueva contraseña" subtitulo="Crea una contraseña nueva para tu cuenta.">
      {!session ? (
        <>
          <Alerta tipo="aviso">El enlace no es válido o ya venció. Solicita uno nuevo.</Alerta>
          <Link to="/recuperar" className="btn-primary mt-5 w-full">Solicitar enlace</Link>
        </>
      ) : (
        <form onSubmit={enviar} className="space-y-4" noValidate>
          {error && <Alerta tipo="error">{error}</Alerta>}
          <Campo label="Nueva contraseña" type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
          <Campo label="Confirmar contraseña" type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
          <button className="btn-primary w-full" disabled={enviando}><KeyRound size={18} /> {enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      )}
    </AuthShell>
  );
}
