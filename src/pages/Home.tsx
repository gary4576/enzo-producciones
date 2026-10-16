import { Link } from 'react-router-dom';
import { Clapperboard, MonitorPlay, Volume2, Lightbulb, Settings2, Clock, AlertTriangle, Target, LogIn, UserPlus, MapPin, CalendarCheck, GanttChartSquare } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const servicios = [
  { i: Clapperboard, t: 'Producción audiovisual', d: 'Capturamos y transmitimos tus mejores momentos.' },
  { i: MonitorPlay, t: 'Alquiler de pantallas LED', d: 'Imágenes de gran impacto para tu evento.' },
  { i: Volume2, t: 'Sonido profesional', d: 'Parlantes, consolas y operación técnica para que todo se escuche claro.' },
  { i: Lightbulb, t: 'Equipos de iluminación', d: 'Creamos ambientes únicos y profesionales.' },
  { i: Settings2, t: 'Servicios técnicos', d: 'Soporte y personal especializado para cada necesidad.' },
];

export default function Home() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link to="/"><Logo className="h-11 w-44 sm:h-12 sm:w-52" /></Link>
          <nav className="hidden gap-8 text-sm text-slate-200 md:flex" aria-label="Secciones">
            <a href="#inicio" className="hover:text-white">Inicio</a>
            <a href="#servicios" className="hover:text-white">Servicios</a>
            <a href="#realidad" className="hover:text-white">Nuestra realidad</a>
            <a href="#sistema" className="hover:text-white">Sistema</a>
          </nav>
          <div className="flex gap-2">
            {session ? (
              <Link to="/app" className="btn-primary btn-sm sm:text-sm">Ir al panel</Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-sm border border-white/30 text-white hover:bg-white/10 sm:text-sm"><LogIn size={16} /> Iniciar sesión</Link>
                <Link to="/registro" className="btn-primary btn-sm hidden sm:inline-flex sm:text-sm"><UserPlus size={16} /> Registrarse</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section id="inicio" className="relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.12) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="pointer-events-none absolute -right-32 top-0 h-[28rem] w-[28rem] rounded-full bg-brand/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-cielo/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">ENZO PRODUCCIONES<br />LED &amp; EVENTOS – CAÑETE S.A.C.</h1>
            <p className="mt-5 max-w-lg text-lg text-slate-200">Hacemos realidad tus eventos con tecnología, creatividad y un gran equipo de trabajo.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={session ? '/app' : '/login'} className="btn-primary px-6 py-3"><LogIn size={18} /> Iniciar sesión</Link>
              {!session && <Link to="/registro" className="btn border border-cielo/60 px-6 py-3 text-cielo hover:bg-cielo/10"><UserPlus size={18} /> Registrarme</Link>}
            </div>
          </div>
          {/* Panel decorativo: escenario LED (ilustración) */}
          <div aria-hidden className="relative mx-auto aspect-[16/10] w-full max-w-xl">
            <div className="absolute inset-0 rounded-2xl border border-cielo/30 bg-gradient-to-br from-navy-800 to-navy-950 shadow-2xl shadow-brand/30" />
            <div className="absolute inset-x-[12%] top-[14%] flex h-[52%] items-center justify-center rounded-lg bg-gradient-to-br from-brand via-fuchsia-500/70 to-cielo shadow-[0_0_60px_rgba(56,189,248,.5)]">
              <span className="text-3xl font-extrabold tracking-widest text-white sm:text-4xl">ENZO</span>
            </div>
            <div className="absolute left-[4%] top-[18%] h-[44%] w-[6%] rounded bg-cielo/70" />
            <div className="absolute right-[4%] top-[18%] h-[44%] w-[6%] rounded bg-brand/80" />
            <div className="absolute inset-x-[6%] bottom-[10%] flex justify-between">
              {[...Array(7)].map((_, i) => <span key={i} className="h-2 w-2 rounded-full bg-cielo shadow-[0_0_12px_#38BDF8]" />)}
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
        <h2 className="text-center text-3xl font-bold text-navy-900">Nuestros servicios</h2>
        <p className="mt-2 text-center text-slate-500">Brindamos soluciones audiovisuales y técnicas para todo tipo de eventos.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {servicios.map(({ i: I, t, d }) => (
            <div key={t} className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cielo-100 text-brand"><I size={28} /></div>
              <h3 className="mt-4 font-semibold text-navy-900">{t}</h3>
              <p className="mt-1 text-sm text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="realidad" className="mx-auto max-w-7xl px-4 pb-16 sm:px-8">
        <div className="grid overflow-hidden rounded-2xl lg:grid-cols-2">
          <div className="bg-navy-900 p-8 text-white">
            <Clock className="text-cielo" size={30} />
            <p className="mt-3 text-sm text-slate-300">Nuestra realidad</p>
            <h3 className="text-2xl font-bold">La puntualidad también es parte del espectáculo</h3>
            <p className="mt-4 text-sm text-slate-200">En ENZO PRODUCCIONES LED &amp; EVENTOS-CAÑETE S.A.C. hemos identificado que algunos trabajadores no llegan a la hora a sus labores y no participan a tiempo en la preparación y montaje de los equipos.</p>
            <p className="mt-3 text-sm text-slate-200">Esto puede generar desorganización del personal, retrasos en las actividades programadas y problemas para cumplir con los horarios acordados con nuestros clientes.</p>
          </div>
          <div className="grid gap-8 bg-cielo-50 p-8 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-navy-900"><AlertTriangle size={20} /> Posibles causas</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                <li>Falta de control de asistencia.</li>
                <li>Comunicación poco anticipada de los horarios.</li>
                <li>Ausencia de un seguimiento constante de las tardanzas.</li>
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-bold text-brand"><Target size={20} /> Nuestro objetivo</h3>
              <p className="mt-3 text-sm text-slate-700">Implementar medidas que permitan mejorar la puntualidad y fortalecer la responsabilidad de los trabajadores.</p>
              <p className="mt-4 font-semibold italic text-brand">¡Juntos hacemos que todo funcione!</p>
            </div>
          </div>
        </div>
      </section>

      <section id="sistema" className="bg-slate-50 px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-navy-900">Un sistema para el personal y el montaje</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { i: CalendarCheck, t: 'Asistencia con puntualidad', d: 'Entrada y salida con hora de Perú, minutos de tardanza calculados automáticamente y control de faltas.' },
              { i: MapPin, t: 'Geolocalización por evento', d: 'Cada marcación guarda el GPS y muestra si el trabajador está dentro del área autorizada.' },
              { i: GanttChartSquare, t: 'Tiempos de montaje', d: 'Actividades con responsable, duración y retrasos en una línea de tiempo tipo Gantt.' },
            ].map(({ i: I, t, d }) => (
              <div key={t} className="card p-6">
                <I className="text-brand" size={28} />
                <h3 className="mt-3 font-semibold text-navy-900">{t}</h3>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-navy-900 px-4 py-6 text-sm text-slate-300 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <strong className="text-white">ENZO PRODUCCIONES LED &amp; EVENTOS - CAÑETE S.A.C.</strong>
          <span className="text-xs">Producción audiovisual | Pantallas LED | Sonido | Iluminación | Servicios técnicos</span>
        </div>
      </footer>
    </div>
  );
}
