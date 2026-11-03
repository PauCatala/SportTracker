-- AVISOS: notificaciones en el móvil aunque SYNCO esté cerrada.
--  1. La app calcula tus próximos avisos (14 días) y los guarda en "avisos".
--  2. Cada móvil u ordenador donde actives los avisos se guarda en "avisos_dispositivos".
--  3. Cada minuto, una tarea programada llama a la función "enviar-avisos", que manda los que ya tocan.
-- Las claves para firmar las notificaciones (VAPID) y el código de la tarea viven en el Vault de Supabase
-- (nombres: avisos_vapid_publica, avisos_vapid_privada, avisos_cron). No están en este repositorio.

create table if not exists public.avisos (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave     text not null,                 -- id del evento + momento del aviso (no se repite)
  cuando    timestamptz not null,
  titulo    text not null,
  cuerpo    text not null default '',
  url       text not null default './',
  enviado   boolean not null default false,
  primary key (user_id, clave)
);
create index if not exists avisos_pendientes on public.avisos (cuando) where not enviado;

create table if not exists public.avisos_dispositivos (
  endpoint  text primary key,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh    text not null,
  auth      text not null,
  nombre    text not null default '',
  creado    timestamptz not null default now()
);
create index if not exists avisos_dispositivos_user on public.avisos_dispositivos (user_id);

alter table public.avisos enable row level security;
alter table public.avisos_dispositivos enable row level security;

drop policy if exists "avisos: los tuyos" on public.avisos;
create policy "avisos: los tuyos" on public.avisos
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dispositivos: los tuyos" on public.avisos_dispositivos;
create policy "dispositivos: los tuyos" on public.avisos_dispositivos
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- La función de envío lee las claves con esto (solo con la clave de servicio)
create or replace function public.avisos_claves()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_object_agg(name, decrypted_secret)
  from vault.decrypted_secrets
  where name in ('avisos_vapid_publica', 'avisos_vapid_privada', 'avisos_cron');
$$;
revoke all on function public.avisos_claves() from public, anon, authenticated;
grant execute on function public.avisos_claves() to service_role;

-- La app pide la clave pública para suscribir el dispositivo
create or replace function public.avisos_clave_publica()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'avisos_vapid_publica' limit 1;
$$;
revoke all on function public.avisos_clave_publica() from public, anon;
grant execute on function public.avisos_clave_publica() to authenticated;

-- Tarea programada: cada minuto
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule('enviar-avisos') where exists (select 1 from cron.job where jobname = 'enviar-avisos');
select cron.schedule('enviar-avisos', '* * * * *', $$
  select net.http_post(
    url := 'https://lqbqlgkuubyukqbhckck.supabase.co/functions/v1/enviar-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-avisos-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'avisos_cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

-- Limpieza: borra avisos enviados o pasados de más de 3 días (una vez al día)
select cron.unschedule('limpiar-avisos') where exists (select 1 from cron.job where jobname = 'limpiar-avisos');
select cron.schedule('limpiar-avisos', '17 4 * * *', $$
  delete from public.avisos where cuando < now() - interval '3 days';
$$);
