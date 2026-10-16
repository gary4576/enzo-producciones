import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { Alerta, Campo } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { mensajeError, reEmail } from '../lib/validar';

export default function Recuperar() {
  const { recuperarPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!reEmail.test(email)) { setError('Ingresa un correo válido.'); return; }
    setError(''); setEnviando(true);
    try { await recuperarPassword(email.trim()); setOk(true); }
    catch (err) { setError(mensajeError(err)); }
    finally { setEnviando(false); }
  };

  return (
    <AuthShell titulo="Recuperar contraseña" subtitulo="Te enviaremos un enlace para crear una nueva contraseña."
      pie={<Link to="/login" className="font-semibold text-brand hover:underline">Volver a iniciar sesión</Link>}>
      {ok ? (
        <Alerta tipo="ok">Si el correo está registrado, recibirás un enlace en unos minutos. Revisa también la carpeta de spam.</Alerta>
      ) : (
        <form onSubmit={enviar} className="space-y-4" noValidate>
          {error && <Alerta tipo="error">{error}</Alerta>}
          <Campo label="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary w-full" disabled={enviando}><Mail size={18} /> {enviando ? 'Enviando…' : 'Enviar enlace'}</button>
        </form>
      )}
    </AuthShell>
  );
}
