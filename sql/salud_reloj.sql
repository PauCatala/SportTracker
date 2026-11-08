-- SALUD · RELOJ
-- Lo que llega de tu reloj y de la app Salud del iPhone, y los entrenos que se suben solos desde Strava.
-- Solo añade cosas nuevas: no cambia ni borra nada de lo que ya existe.

-- 1) Un día de tu cuerpo: sueño, pulso, pasos… (una fila por día)
create table if not exists public.salud_dias (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fecha date not null,
  pasos integer,
  distancia_km numeric(6,2),          -- caminando + corriendo
  kcal_activas integer,
  minutos_ejercicio integer,
  pisos integer,
  sueno_min integer,                  -- total dormido
  sueno_profundo_min integer,
  sueno_rem_min integer,
  sueno_ligero_min integer,
  despierto_min integer,
  fc_media integer,
  fc_min integer,
  fc_max integer,
  fc_reposo integer,
  vfc integer,                        -- variabilidad de la frecuencia cardiaca (ms)
  spo2 numeric(4,1),                  -- saturación de oxígeno (%)
  peso numeric(5,2),
  fuente text,
  crudo jsonb,                        -- lo último que llegó tal cual (para revisar el Atajo)
  actualizado timestamptz not null default now(),
  primary key (user_id, fecha)
);
alter table public.salud_dias enable row level security;
drop policy if exists "solo mis datos" on public.salud_dias;
create policy "solo mis datos" on public.salud_dias for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) Tu código secreto para el Atajo del iPhone (el Atajo no puede iniciar sesión, usa este código)
create table if not exists public.salud_conexion (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  token text not null unique check (length(token) >= 24),
  creado timestamptz not null default now(),
  ultimo_envio timestamptz
);
alter table public.salud_conexion enable row level security;
drop policy if exists "solo mis datos" on public.salud_conexion;
create policy "solo mis datos" on public.salud_conexion for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Recibe los datos del Atajo. Solo escribe en la cuenta dueña del código.
--    Si un dato no llega (null), se conserva el que ya había ese día.
create or replace function public.salud_ingesta(p_token text, p_dia jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_fecha date;
begin
  if p_token is null or length(p_token) < 24 then return 'codigo'; end if;
  select user_id into v_user from salud_conexion where token = p_token;
  if v_user is null then return 'codigo'; end if;
  v_fecha := (p_dia->>'fecha')::date;
  if v_fecha is null or v_fecha > current_date + 1 or v_fecha < current_date - 400 then return 'fecha'; end if;

  insert into salud_dias as s (user_id, fecha, pasos, distancia_km, kcal_activas, minutos_ejercicio, pisos,
    sueno_min, sueno_profundo_min, sueno_rem_min, sueno_ligero_min, despierto_min,
    fc_media, fc_min, fc_max, fc_reposo, vfc, spo2, peso, fuente, crudo, actualizado)
  values (v_user, v_fecha,
    (p_dia->>'pasos')::int, (p_dia->>'distancia_km')::numeric, (p_dia->>'kcal_activas')::int,
    (p_dia->>'minutos_ejercicio')::int, (p_dia->>'pisos')::int,
    (p_dia->>'sueno_min')::int, (p_dia->>'sueno_profundo_min')::int, (p_dia->>'sueno_rem_min')::int,
    (p_dia->>'sueno_ligero_min')::int, (p_dia->>'despierto_min')::int,
    (p_dia->>'fc_media')::int, (p_dia->>'fc_min')::int, (p_dia->>'fc_max')::int, (p_dia->>'fc_reposo')::int,
    (p_dia->>'vfc')::int, (p_dia->>'spo2')::numeric, (p_dia->>'peso')::numeric,
    coalesce(p_dia->>'fuente', 'Apple Salud'), p_dia->'crudo', now())
  on conflict (user_id, fecha) do update set
    pasos = coalesce(excluded.pasos, s.pasos),
    distancia_km = coalesce(excluded.distancia_km, s.distancia_km),
    kcal_activas = coalesce(excluded.kcal_activas, s.kcal_activas),
    minutos_ejercicio = coalesce(excluded.minutos_ejercicio, s.minutos_ejercicio),
    pisos = coalesce(excluded.pisos, s.pisos),
    sueno_min = coalesce(excluded.sueno_min, s.sueno_min),
    sueno_profundo_min = coalesce(excluded.sueno_profundo_min, s.sueno_profundo_min),
    sueno_rem_min = coalesce(excluded.sueno_rem_min, s.sueno_rem_min),
    sueno_ligero_min = coalesce(excluded.sueno_ligero_min, s.sueno_ligero_min),
    despierto_min = coalesce(excluded.despierto_min, s.despierto_min),
    fc_media = coalesce(excluded.fc_media, s.fc_media),
    fc_min = coalesce(excluded.fc_min, s.fc_min),
    fc_max = coalesce(excluded.fc_max, s.fc_max),
    fc_reposo = coalesce(excluded.fc_reposo, s.fc_reposo),
    vfc = coalesce(excluded.vfc, s.vfc),
    spo2 = coalesce(excluded.spo2, s.spo2),
    peso = coalesce(excluded.peso, s.peso),
    fuente = excluded.fuente,
    crudo = excluded.crudo,
    actualizado = now();
  update salud_conexion set ultimo_envio = now() where user_id = v_user;
  return 'ok';
end;
$$;
revoke all on function public.salud_ingesta(text, jsonb) from public;
grant execute on function public.salud_ingesta(text, jsonb) to anon, authenticated;

-- 4) Conexión con Strava (los tokens solo los ve su dueño)
create table if not exists public.strava_conexion (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  athlete_id bigint,
  nombre text,
  access_token text,
  refresh_token text,
  expira bigint,                      -- segundos desde 1970
  ultimo_sync bigint not null default 0,
  actualizado timestamptz not null default now()
);
alter table public.strava_conexion enable row level security;
drop policy if exists "solo mis datos" on public.strava_conexion;
create policy "solo mis datos" on public.strava_conexion for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5) Todos tus entrenos del reloj (running, bici, natación, fútbol…)
create table if not exists public.actividades (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fecha date not null,
  inicio timestamptz,
  deporte text not null,              -- correr, bici, nadar, caminar, gimnasio, futbol, baloncesto, otro
  tipo_origen text,                   -- el tipo tal cual lo da Strava (Run, Ride, Swim…)
  nombre text,
  distancia_km numeric(7,2),
  duracion_seg integer,               -- tiempo en movimiento
  tiempo_total_seg integer,
  desnivel_m numeric(7,1),
  fc_media integer,
  fc_max integer,
  kcal integer,
  vel_media_kmh numeric(5,2),
  potencia_media integer,
  cadencia numeric(5,1),
  mapa text,                          -- recorrido codificado (polilínea de Strava)
  fuente text not null default 'strava',
  externo_id text,
  creado_en timestamptz not null default now(),
  unique (user_id, externo_id)
);
alter table public.actividades enable row level security;
drop policy if exists "solo mis datos" on public.actividades;
create policy "solo mis datos" on public.actividades for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists actividades_user_fecha on public.actividades (user_id, fecha desc);

-- Las carreras que llegan de Strava no se duplican: carreras.strava_id ya es único.
