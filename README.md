# ENZO PRODUCCIONES LED & EVENTOS – CAÑETE S.A.C.
Sistema web de **asistencia con geolocalización, eventos y tiempos de montaje**.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Supabase (Auth + PostgreSQL + RLS) · Leaflet + OpenStreetMap · Recharts

---

## 1. Estructura de carpetas

```
enzo-producciones/
├── supabase/
│   └── schema.sql            ← tablas, funciones, triggers y políticas RLS
├── public/favicon.svg
├── src/
│   ├── main.tsx · App.tsx · index.css
│   ├── context/AuthContext.tsx        ← sesión, perfil, roles
│   ├── lib/
│   │   ├── supabase.ts                ← cliente (solo clave anon)
│   │   ├── types.ts · validar.ts
│   │   ├── time.ts                    ← zona horaria de Perú (UTC-5)
│   │   ├── geo.ts                     ← GPS, distancia, búsqueda de direcciones
│   │   ├── schedule.ts                ← cálculo automático de horarios de montaje
│   │   └── csv.ts                     ← exportación CSV
│   ├── components/
│   │   ├── Layout · ProtectedRoute · AuthShell · Logo
│   │   ├── MapView (Leaflet) · Gantt · EventForm · TaskForm
│   │   └── ui.tsx · Toast.tsx
│   └── pages/
│       ├── Home · Login · Registro · Recuperar · Restablecer      (públicas)
│       └── Dashboard · Asistencia · Eventos · EventoDetalle
│           Trabajadores · Reportes · Perfil · Configuracion       (privadas)
├── .env.example
├── package.json · vite.config.ts · tailwind.config.js · tsconfig.json · index.html
```

## 2. Puesta en marcha

### a) Instalar dependencias
Requiere Node.js 18 o superior.
```bash
npm install
```

### b) Crear el proyecto en Supabase
1. Entra a https://supabase.com y crea un proyecto.
2. Ve a **SQL Editor → New query**, pega **todo** el contenido de `supabase/schema.sql` y pulsa **Run**.
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**  (¡nunca uses la `service_role` en el frontend!)

### c) Variables de entorno
```bash
cp .env.example .env
```
Edita `.env`:
```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### d) Configurar Authentication en Supabase
En **Authentication → URL Configuration**:
- **Site URL:** `http://localhost:5173` (en producción, tu dominio).
- **Redirect URLs:** agrega `http://localhost:5173/login` y `http://localhost:5173/restablecer`.

Por defecto Supabase exige **confirmar el correo** al registrarse; la app lo maneja. Para pruebas rápidas puedes desactivarlo en *Authentication → Providers → Email → Confirm email*.

### e) Crear el primer administrador
1. Inicia la app (`npm run dev`) y **regístrate** desde `/registro`.
2. En el SQL Editor ejecuta (con tu correo):
```sql
update public.profiles set rol = 'administrador' where email = 'tu-correo@ejemplo.com';
```
3. Cierra sesión y vuelve a entrar. Desde **Trabajadores** el administrador ya puede asignar roles `supervisor` o `administrador` a los demás.

### f) Configurar la sede
Como administrador entra a **Configuración**: define horario de jornada, tolerancia en minutos y marca la ubicación de la sede en el mapa.

### g) Ejecutar
```bash
npm run dev        # desarrollo  → http://localhost:5173
npm run build      # producción  → carpeta dist/
```
> La geolocalización del navegador solo funciona en **HTTPS** o en `localhost`.

---

## 3. Roles y permisos

| Acción | Trabajador | Supervisor | Administrador |
|---|:-:|:-:|:-:|
| Marcar su entrada/salida | ✔ | ✔ | ✔ |
| Ver su propio historial y perfil | ✔ | ✔ | ✔ |
| Ver eventos | solo los asignados | todos | todos |
| Iniciar/finalizar sus actividades de montaje | ✔ | ✔ | ✔ |
| Ver y editar todos los eventos, asignar personal, crear actividades | – | ✔ | ✔ |
| Ver asistencia de todos, registrar/justificar faltas, reportes | – | ✔ | ✔ |
| Ver lista de trabajadores | – | ✔ | ✔ |
| Cambiar roles, activar/desactivar cuentas, editar trabajadores | – | – | ✔ |
| Configuración de sede/horario, eliminar eventos | – | – | ✔ |

Todo se aplica **en la base de datos con RLS** (no solo en la interfaz). El trigger `proteger_perfil` impide que alguien cambie su propio rol; el rol de un usuario nuevo siempre es `trabajador`.

## 4. Cómo funciona

**Asistencia.** Los botones *Marcar entrada / salida* llaman a funciones RPC (`marcar_entrada`, `marcar_salida`). La **hora y la tardanza las calcula el servidor** (el trabajador no puede manipularlas):
- Hora programada = *hora de citación* del evento asignado, o la hora de entrada de la sede (Configuración).
- Si llega después de la tolerancia, se registran **todos los minutos** de retraso y el estado `tardanza`.
- Un registro por trabajador y día (restricción `UNIQUE (worker_id, fecha)`): se evitan duplicados.
- Requiere GPS; guarda coordenadas y precisión, calcula la distancia (Haversine) al punto del evento/sede y marca **dentro/fuera** según el radio.
- Faltas: el supervisor las registra (justificada / injustificada) o usa *Marcar faltas de un día*, que marca falta injustificada a quienes estaban asignados a un evento ese día y no marcaron. Luego se pueden justificar.

**Eventos.** Nombre, cliente, fecha, citación/inicio/fin, dirección, ubicación en mapa (buscar o clic), radio permitido, estado, trabajadores asignados y equipos necesarios.

**Montaje.** Cada actividad tiene responsable, duración, inicio opcional y dependencias:
- Inicio = el mayor entre su hora manual y el fin de sus dependencias (o la hora de citación). Fin estimado = inicio + duración.
- Las actividades **sin dependencia entre sí se ejecutan en paralelo**.
- El responsable pulsa *Iniciar* / *Finalizar*; el servidor guarda las horas reales y bloquea iniciar si hay dependencias sin completar.
- Se muestran retrasos, tiempo real, cruces de un mismo responsable, aviso si el montaje termina después del inicio del evento y un **Gantt**.

**Reportes.** Asistencia y actividades de montaje, filtrables por fechas, trabajador y evento, con exportación **CSV** (compatible con Excel).

## 5. Seguridad
- Solo se usa la clave pública `anon`; `.env` está en `.gitignore`.
- RLS activo en todas las tablas; los trabajadores solo leen sus propios datos (asistencia, perfil). La vista `equipo_evento` solo expone nombre y cargo de los compañeros de sus eventos.
- Las contraseñas las gestiona Supabase Auth (nunca se guardan ni se muestran).

## 6. Pruebas recomendadas (checklist)
1. Registrar 2 usuarios, convertir uno en administrador (paso e) y dejar el otro como trabajador.
2. **Login / permisos:** con el trabajador intenta abrir `/app/reportes` → debe redirigir. Cierra sesión y abre `/app` → debe ir a login. Prueba "¿Olvidaste tu contraseña?".
3. **Sede:** en Configuración fija la ubicación.
4. **Evento:** crea un evento de **hoy** con ubicación, asigna al trabajador, agrega equipos.
5. **Asistencia:** como trabajador, marca entrada (permite el GPS) → revisa estado, minutos de tardanza y *dentro/fuera*. Intenta marcar de nuevo → debe rechazar. Marca salida.
6. **Montaje:** crea actividades (algunas con dependencia, otras en paralelo), inicia/finaliza como trabajador, revisa Gantt y retrasos.
7. **Reportes:** genera y exporta CSV.

## 7. Notas
- Los textos de la web de inicio vienen de tus imágenes de referencia. No se incluyen datos de contacto, fotos ni cifras inventadas; agrégalos cuando los tengas.
- El logo es una versión vectorial (`src/components/Logo.tsx`). Para usar el logo oficial, reemplaza el componente por una `<img>` con tu archivo en `public/`.
- Mapas: teselas de OpenStreetMap y búsqueda con Nominatim (uso ligero). Para mucho tráfico considera un proveedor propio de teselas.
