-- =====================================================================
-- ENZO PRODUCCIONES LED & EVENTOS – CAÑETE S.A.C.
-- Esquema de base de datos para Supabase (PostgreSQL)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- Es seguro volver a ejecutarlo (usa IF NOT EXISTS / OR REPLACE).
-- Zona horaria de negocio: America/Lima (UTC-5, sin horario de verano)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nombres      text not null check (char_length(nombres) between 3 and 120),
  dni          text not null unique check (dni ~ '^[0-9]{8}$'),
  email        text not null,
  celular      text not null check (celular ~ '^9[0-9]{8}$'),
  cargo        text not null,
  especialidad text,
  rol          text not null default 'trabajador'
               check (rol in ('administrador','supervisor','trabajador')),
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Configuración general (una sola fila)
create table if not exists public.config (
  id            int primary key default 1 check (id = 1),
  hora_entrada  time not null default '08:00',
  hora_salida   time not null default '17:00',
  tolerancia_min int not null default 5 check (tolerancia_min >= 0),
  sede_lat      float8,
  sede_lng      float8,
  sede_radio_m  int not null default 100 check (sede_radio_m between 10 and 5000)
);
insert into public.config (id) values (1) on conflict (id) do nothing;

create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  cliente        text not null,
  fecha          date not null,
  hora_citacion  time not null,          -- hora a la que debe presentarse el personal
  hora_inicio    time not null,          -- inicio del evento
  hora_fin       time not null,
  direccion      text not null,
  lat            float8,
  lng            float8,
  radio_m        int not null default 100 check (radio_m between 10 and 5000),
  estado         text not null default 'programado'
                 check (estado in ('programado','en_montaje','en_curso','finalizado','cancelado')),
  notas          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists events_fecha_idx on public.events (fecha);

create table if not exists public.event_workers (
  event_id   uuid not null references public.events(id) on delete cascade,
  worker_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (event_id, worker_id)
);

create table if not exists public.event_equipment (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.events(id) on delete cascade,
  nombre    text not null,
  cantidad  int not null default 1 check (cantidad > 0)
);
create index if not exists event_equipment_event_idx on public.event_equipment (event_id);

create table if not exists public.attendance (
  id                   uuid primary key default gen_random_uuid(),
  worker_id            uuid not null references public.profiles(id) on delete cascade,
  event_id             uuid references public.events(id) on delete set null,
  fecha                date not null,                 -- fecha en hora de Perú
  hora_programada      timestamptz,
  hora_entrada         timestamptz,
  hora_salida          timestamptz,
  minutos_tardanza     int not null default 0 check (minutos_tardanza >= 0),
  estado               text not null
                       check (estado in ('puntual','tardanza','falta_justificada','falta_injustificada')),
  entrada_lat          float8,
  entrada_lng          float8,
  entrada_precision_m  float8,
  entrada_distancia_m  float8,
  entrada_dentro_area  boolean,
  salida_lat           float8,
  salida_lng           float8,
  salida_precision_m   float8,
  salida_distancia_m   float8,
  salida_dentro_area   boolean,
  observaciones        text,
  justificacion        text,
  created_at           timestamptz not null default now(),
  -- Evita registros duplicados: un registro por trabajador y día
  constraint attendance_unico_por_dia unique (worker_id, fecha),
  constraint attendance_salida_valida check (
    hora_salida is null or hora_entrada is null or hora_salida >= hora_entrada)
);
create index if not exists attendance_fecha_idx on public.attendance (fecha);
create index if not exists attendance_event_idx on public.attendance (event_id);

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  nombre         text not null,
  categoria      text not null default 'otro'
                 check (categoria in ('transporte','pantallas_led','sonido','iluminacion','cableado','consolas','pruebas','otro')),
  responsable_id uuid references public.profiles(id) on delete set null,
  depende_de     uuid[] not null default '{}',     -- actividades previas
  inicio_plan    timestamptz,                      -- si es NULL: inicia al terminar sus dependencias (o a la hora de citación)
  duracion_min   int not null check (duracion_min > 0),
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente','en_progreso','completada')),
  inicio_real    timestamptz,
  fin_real       timestamptz,
  notas          text,
  created_at     timestamptz not null default now()
);
create index if not exists tasks_event_idx on public.tasks (event_id);
create index if not exists tasks_resp_idx on public.tasks (responsable_id);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES
-- ---------------------------------------------------------------------

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and rol = 'administrador' and activo);
$$;

create or replace function public.es_staff() returns boolean   -- administrador o supervisor
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and rol in ('administrador','supervisor') and activo);
$$;

-- Distancia en metros entre dos coordenadas (fórmula de Haversine)
create or replace function public.distancia_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------

-- Crea el perfil al registrarse. El rol SIEMPRE es 'trabajador'
-- (nunca se toma del cliente, para evitar escalada de privilegios).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombres, dni, email, celular, cargo)
  values (
    new.id,
    trim(new.raw_user_meta_data->>'nombres'),
    trim(new.raw_user_meta_data->>'dni'),
    new.email,
    trim(new.raw_user_meta_data->>'celular'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'cargo'), ''), 'Trabajador')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Un usuario normal no puede cambiar su rol, estado, DNI ni correo.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() es NULL cuando se ejecuta desde el SQL Editor (postgres)
  if auth.uid() is not null and not public.es_admin() then
    if new.id <> old.id or new.rol <> old.rol or new.activo <> old.activo
       or new.dni <> old.dni or new.email <> old.email then
      raise exception 'No tienes permiso para modificar rol, estado, DNI o correo.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists proteger_perfil_trg on public.profiles;
create trigger proteger_perfil_trg
  before update on public.profiles for each row execute function public.proteger_perfil();

-- ---------------------------------------------------------------------
-- 4. VISTA: compañeros de cada evento (solo id, nombre y cargo)
--    Permite que un trabajador vea con quién comparte un evento
--    sin exponer DNI, correo ni celular de nadie.
-- ---------------------------------------------------------------------
create or replace view public.equipo_evento as
  select ew.event_id, p.id as worker_id, p.nombres, p.cargo, p.especialidad
  from public.event_workers ew
  join public.profiles p on p.id = ew.worker_id
  where public.es_staff()
     or exists (select 1 from public.event_workers me
                where me.event_id = ew.event_id and me.worker_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. FUNCIONES RPC (la hora y la tardanza las calcula el SERVIDOR)
-- ---------------------------------------------------------------------

create or replace function public.marcar_entrada(
  p_event_id uuid, p_lat float8, p_lng float8, p_precision float8, p_obs text default null)
returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_now   timestamptz := now();
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_cfg   public.config%rowtype;
  v_prog  timestamptz;
  v_olat  float8; v_olng float8; v_radio int;
  v_dist  float8; v_dentro boolean;
  v_min   int; v_estado text;
  v_row   public.attendance;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión.'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and activo) then
    raise exception 'Tu cuenta está desactivada.';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'La ubicación GPS es obligatoria para marcar asistencia.';
  end if;
  if exists (select 1 from public.attendance where worker_id = v_uid and fecha = v_hoy) then
    raise exception 'Ya registraste tu asistencia de hoy.';
  end if;

  select * into v_cfg from public.config where id = 1;

  if p_event_id is not null then
    select ((e.fecha + e.hora_citacion) at time zone 'America/Lima'), e.lat, e.lng, e.radio_m
      into v_prog, v_olat, v_olng, v_radio
      from public.events e
      join public.event_workers ew on ew.event_id = e.id and ew.worker_id = v_uid
     where e.id = p_event_id and e.fecha = v_hoy and e.estado <> 'cancelado';
    if not found then
      raise exception 'No estás asignado a ese evento para hoy.';
    end if;
  else
    v_prog  := (v_hoy + v_cfg.hora_entrada) at time zone 'America/Lima';
    v_olat  := v_cfg.sede_lat; v_olng := v_cfg.sede_lng; v_radio := v_cfg.sede_radio_m;
  end if;

  if v_olat is not null and v_olng is not null then
    v_dist   := public.distancia_m(p_lat, p_lng, v_olat, v_olng);
    v_dentro := v_dist <= v_radio;
  end if;

  v_min := greatest(0, floor(extract(epoch from (v_now - v_prog)) / 60)::int);
  if v_min > v_cfg.tolerancia_min then
    v_estado := 'tardanza';
  else
    v_estado := 'puntual'; v_min := 0;
  end if;

  insert into public.attendance (worker_id, event_id, fecha, hora_programada, hora_entrada,
      minutos_tardanza, estado, entrada_lat, entrada_lng, entrada_precision_m,
      entrada_distancia_m, entrada_dentro_area, observaciones)
  values (v_uid, p_event_id, v_hoy, v_prog, v_now, v_min, v_estado, p_lat, p_lng, p_precision,
      v_dist, v_dentro, nullif(trim(p_obs), ''))
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.marcar_salida(
  p_lat float8, p_lng float8, p_precision float8, p_obs text default null)
returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_hoy  date := (now() at time zone 'America/Lima')::date;
  v_cfg  public.config%rowtype;
  v_att  public.attendance;
  v_olat float8; v_olng float8; v_radio int;
  v_dist float8; v_dentro boolean;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_lat is null or p_lng is null then
    raise exception 'La ubicación GPS es obligatoria para marcar asistencia.';
  end if;

  select * into v_att from public.attendance
   where worker_id = v_uid and fecha = v_hoy and hora_entrada is not null;
  if not found then raise exception 'Primero debes registrar tu entrada de hoy.'; end if;
  if v_att.hora_salida is not null then raise exception 'Ya registraste tu salida de hoy.'; end if;

  select * into v_cfg from public.config where id = 1;
  if v_att.event_id is not null then
    select e.lat, e.lng, e.radio_m into v_olat, v_olng, v_radio from public.events e where e.id = v_att.event_id;
  else
    v_olat := v_cfg.sede_lat; v_olng := v_cfg.sede_lng; v_radio := v_cfg.sede_radio_m;
  end if;
  if v_olat is not null and v_olng is not null then
    v_dist := public.distancia_m(p_lat, p_lng, v_olat, v_olng);
    v_dentro := v_dist <= v_radio;
  end if;

  update public.attendance set
    hora_salida = now(), salida_lat = p_lat, salida_lng = p_lng, salida_precision_m = p_precision,
    salida_distancia_m = v_dist, salida_dentro_area = v_dentro,
    observaciones = case when nullif(trim(p_obs), '') is null then observaciones
                         else coalesce(observaciones || ' | ', '') || trim(p_obs) end
   where id = v_att.id returning * into v_att;
  return v_att;
end $$;

-- Marca como falta injustificada a quienes estaban asignados a un evento
-- de esa fecha y no registraron asistencia. Solo administrador/supervisor.
create or replace function public.marcar_faltas(p_fecha date) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.es_staff() then raise exception 'No autorizado.'; end if;
  if p_fecha > (now() at time zone 'America/Lima')::date then
    raise exception 'No se pueden marcar faltas en fechas futuras.';
  end if;
  insert into public.attendance (worker_id, event_id, fecha, estado, observaciones)
  select distinct on (ew.worker_id) ew.worker_id, e.id, p_fecha, 'falta_injustificada',
         'Generada por no registrar asistencia al evento asignado'
    from public.events e
    join public.event_workers ew on ew.event_id = e.id
    join public.profiles p on p.id = ew.worker_id and p.activo
   where e.fecha = p_fecha and e.estado <> 'cancelado'
     and not exists (select 1 from public.attendance a where a.worker_id = ew.worker_id and a.fecha = p_fecha)
  on conflict (worker_id, fecha) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Cambia el estado de una actividad. El responsable (o staff) la inicia o
-- finaliza; las horas reales las pone el servidor.
create or replace function public.actualizar_tarea(p_id uuid, p_estado text)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_id;
  if not found then raise exception 'Actividad no encontrada.'; end if;
  if not (public.es_staff() or t.responsable_id = auth.uid()) then
    raise exception 'Solo el responsable puede actualizar esta actividad.';
  end if;
  if p_estado not in ('pendiente','en_progreso','completada') then
    raise exception 'Estado no válido.';
  end if;
  if p_estado = 'pendiente' and not public.es_staff() then
    raise exception 'Solo un supervisor puede reiniciar una actividad.';
  end if;
  if p_estado in ('en_progreso','completada') and exists (
       select 1 from public.tasks d where d.id = any (t.depende_de) and d.estado <> 'completada') then
    raise exception 'Hay actividades previas sin completar.';
  end if;

  update public.tasks set
    estado = p_estado,
    inicio_real = case p_estado when 'pendiente' then null else coalesce(inicio_real, now()) end,
    fin_real    = case p_estado when 'completada' then now() else null end
   where id = p_id returning * into t;
  return t;
end $$;

revoke all on function public.marcar_entrada(uuid, float8, float8, float8, text) from public, anon;
revoke all on function public.marcar_salida(float8, float8, float8, text) from public, anon;
revoke all on function public.marcar_faltas(date) from public, anon;
revoke all on function public.actualizar_tarea(uuid, text) from public, anon;
grant execute on function public.marcar_entrada(uuid, float8, float8, float8, text) to authenticated;
grant execute on function public.marcar_salida(float8, float8, float8, text) to authenticated;
grant execute on function public.marcar_faltas(date) to authenticated;
grant execute on function public.actualizar_tarea(uuid, text) to authenticated;
revoke all on public.equipo_evento from anon;
grant select on public.equipo_evento to authenticated;

-- ---------------------------------------------------------------------
-- 6. POLÍTICAS RLS
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.config          enable row level security;
alter table public.events          enable row level security;
alter table public.event_workers   enable row level security;
alter table public.event_equipment enable row level security;
alter table public.attendance      enable row level security;
alter table public.tasks           enable row level security;

-- profiles: cada quien ve el suyo; staff ve todos; admin gestiona
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.es_staff());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.es_admin());

-- config: todos los autenticados leen; solo admin modifica
drop policy if exists config_select on public.config;
create policy config_select on public.config for select to authenticated using (true);
drop policy if exists config_update on public.config;
create policy config_update on public.config for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- events
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (public.es_staff() or exists (
    select 1 from public.event_workers ew where ew.event_id = events.id and ew.worker_id = auth.uid()));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated with check (public.es_staff());
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.es_staff()) with check (public.es_staff());
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated using (public.es_admin());

-- event_workers
drop policy if exists ew_select on public.event_workers;
create policy ew_select on public.event_workers for select to authenticated
  using (worker_id = auth.uid() or public.es_staff());
drop policy if exists ew_write on public.event_workers;
create policy ew_write on public.event_workers for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

-- event_equipment
drop policy if exists eq_select on public.event_equipment;
create policy eq_select on public.event_equipment for select to authenticated
  using (public.es_staff() or exists (
    select 1 from public.event_workers ew where ew.event_id = event_equipment.event_id and ew.worker_id = auth.uid()));
drop policy if exists eq_write on public.event_equipment;
create policy eq_write on public.event_equipment for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

-- attendance: los trabajadores solo LEEN lo suyo; escriben vía RPC
drop policy if exists att_select on public.attendance;
create policy att_select on public.attendance for select to authenticated
  using (worker_id = auth.uid() or public.es_staff());
drop policy if exists att_insert on public.attendance;
create policy att_insert on public.attendance for insert to authenticated with check (public.es_staff());
drop policy if exists att_update on public.attendance;
create policy att_update on public.attendance for update to authenticated
  using (public.es_staff()) with check (public.es_staff());
drop policy if exists att_delete on public.attendance;
create policy att_delete on public.attendance for delete to authenticated using (public.es_admin());

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.es_staff() or exists (
    select 1 from public.event_workers ew where ew.event_id = tasks.event_id and ew.worker_id = auth.uid()));
drop policy if exists tasks_write on public.tasks;
create policy tasks_write on public.tasks for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

-- =====================================================================
-- 7. PRIMER ADMINISTRADOR
-- Regístrate desde la web y luego ejecuta (cambiando el correo):
--
--   update public.profiles set rol = 'administrador'
--   where email = 'tu-correo@ejemplo.com';
-- =====================================================================
