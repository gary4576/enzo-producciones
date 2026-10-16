import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { Alerta, Campo } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { mensajeError, reEmail } from '../lib/validar';

export default function Login() {
  const { session, iniciarSesion } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (session) return <Navigate to="/app" replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errores = {};
    if (!reEmail.test(email)) er.email = 'Ingresa un correo válido.';
    if (!password) er.password = 'Ingresa tu contraseña.';
    setErrores(er);
    setError('');
    if (Object.keys(er).length) return;
    setEnviando(true);
    try {
      await iniciarSesion(email.trim(), password);
      nav((loc.state as { desde?: string } | null)?.desde ?? '/app', { replace: true });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AuthShell titulo="Iniciar sesión" subtitulo="Ingresa con tu correo y contraseña."
      pie={<>¿Aún no tienes cuenta? <Link className="font-semibold text-brand hover:underline" to="/registro">Regístrate</Link></>}>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        {error && <Alerta tipo="error">{error}</Alerta>}
        <Campo label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email} />
        <Campo label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errores.password} />
        <div className="text-right text-sm"><Link to="/recuperar" className="text-brand hover:underline">¿Olvidaste tu contraseña?</Link></div>
        <button className="btn-primary w-full" disabled={enviando}><LogIn size={18} /> {enviando ? 'Ingresando…' : 'Iniciar sesión'}</button>
      </form>
    </AuthShell>
  );
}
