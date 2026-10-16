import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { Alerta, Campo } from '../components/ui';
import { useAuth, type DatosRegistro } from '../context/AuthContext';
import { mensajeError, reCelular, reDni, reEmail, type Errores } from '../lib/validar';

const CARGOS = ['Técnico de eventos', 'Operador de pantallas LED', 'Técnico de sonido', 'Técnico de iluminación', 'Montajista', 'Chofer', 'Asistente', 'Supervisor de montaje'];

export default function Registro() {
  const { session, registrar } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ nombres: '', dni: '', email: '', celular: '', cargo: '', password: '', confirmar: '' });
  const [errores, setErrores] = useState<Errores<typeof f>>({});
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (session && !exito) return <Navigate to="/app" replace />;
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const er: Errores<typeof f> = {};
    if (f.nombres.trim().length < 3) er.nombres = 'Ingresa tus nombres completos.';
    if (!reDni.test(f.dni)) er.dni = 'El DNI debe tener 8 dígitos.';
    if (!reEmail.test(f.email)) er.email = 'Ingresa un correo válido.';
    if (!reCelular.test(f.celular)) er.celular = 'El celular debe tener 9 dígitos y empezar con 9.';
    if (f.cargo.trim().length < 2) er.cargo = 'Indica tu cargo.';
    if (f.password.length < 8) er.password = 'Mínimo 8 caracteres.';
    else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) er.password = 'Debe incluir letras y números.';
    if (f.confirmar !== f.password) er.confirmar = 'Las contraseñas no coinciden.';
    setErrores(er);
    setError('');
    if (Object.keys(er).length) return;
    setEnviando(true);
    try {
      const datos: DatosRegistro = { nombres: f.nombres.trim(), dni: f.dni, email: f.email.trim(), celular: f.celular, cargo: f.cargo.trim(), password: f.password };
      const { requiereConfirmacion } = await registrar(datos);
      if (requiereConfirmacion) setExito(true);
      else nav('/app', { replace: true });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  if (exito) {
    return (
      <AuthShell titulo="Revisa tu correo">
        <Alerta tipo="ok">Te enviamos un enlace de confirmación a <strong>{f.email}</strong>. Confírmalo y luego inicia sesión.</Alerta>
        <Link to="/login" className="btn-primary mt-5 w-full">Ir a iniciar sesión</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Crear cuenta" subtitulo="Tu cuenta se crea como trabajador. Un administrador puede cambiar tu rol."
      pie={<>¿Ya tienes cuenta? <Link className="font-semibold text-brand hover:underline" to="/login">Inicia sesión</Link></>}>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        {error && <Alerta tipo="error">{error}</Alerta>}
        <Campo label="Nombres y apellidos" value={f.nombres} onChange={set('nombres')} error={errores.nombres} autoComplete="name" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="DNI" inputMode="numeric" maxLength={8} value={f.dni} onChange={(e) => setF({ ...f, dni: e.target.value.replace(/\D/g, '') })} error={errores.dni} />
          <Campo label="Celular" inputMode="numeric" maxLength={9} value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value.replace(/\D/g, '') })} error={errores.celular} autoComplete="tel" />
        </div>
        <Campo label="Correo electrónico" type="email" value={f.email} onChange={set('email')} error={errores.email} autoComplete="email" />
        <div>
          <Campo label="Cargo" list="cargos" value={f.cargo} onChange={set('cargo')} error={errores.cargo} />
          <datalist id="cargos">{CARGOS.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <Campo label="Contraseña" type="password" value={f.password} onChange={set('password')} error={errores.password} ayuda="Mínimo 8 caracteres, con letras y números." autoComplete="new-password" />
        <Campo label="Confirmar contraseña" type="password" value={f.confirmar} onChange={set('confirmar')} error={errores.confirmar} autoComplete="new-password" />
        <button className="btn-primary w-full" disabled={enviando}><UserPlus size={18} /> {enviando ? 'Creando cuenta…' : 'Registrarme'}</button>
      </form>
    </AuthShell>
  );
}
