import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { supabaseConfigurado } from './lib/supabase';
import { Alerta } from './components/ui';
import Home from './pages/Home';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Recuperar from './pages/Recuperar';
import Restablecer from './pages/Restablecer';
import Dashboard from './pages/Dashboard';
import Asistencia from './pages/Asistencia';
import Eventos from './pages/Eventos';
import EventoDetalle from './pages/EventoDetalle';
import Trabajadores from './pages/Trabajadores';
import Reportes from './pages/Reportes';
import Perfil from './pages/Perfil';
import Configuracion from './pages/Configuracion';

export default function App() {
  return (
    <>
      {!supabaseConfigurado && (
        <div className="sticky top-0 z-[3000]">
          <Alerta tipo="aviso">
            <strong>Supabase no está configurado.</strong> Copia <code>.env.example</code> como <code>.env</code>, completa
            <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> y reinicia <code>npm run dev</code>.
          </Alerta>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="asistencia" element={<Asistencia />} />
          <Route path="eventos" element={<Eventos />} />
          <Route path="eventos/:id" element={<EventoDetalle />} />
          <Route path="trabajadores" element={<ProtectedRoute roles={['administrador', 'supervisor']}><Trabajadores /></ProtectedRoute>} />
          <Route path="reportes" element={<ProtectedRoute roles={['administrador', 'supervisor']}><Reportes /></ProtectedRoute>} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="configuracion" element={<ProtectedRoute roles={['administrador']}><Configuracion /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
