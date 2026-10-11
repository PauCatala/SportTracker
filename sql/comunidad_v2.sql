-- Lumen · Comunidad 2.0
-- Publicaciones públicas (opcionales; por defecto todo sigue siendo PRIVADO), me gusta, comentarios,
-- bloqueos, denuncias y biografía en el perfil. Toda la privacidad se aplica en la base de datos (RLS).

alter table public.perfiles_publicos add column if not exists bio text check (char_length(bio) <= 160);
alter table public.perfiles_publicos add column if not exists mostrar_avatar boolean not null default false;

alter table public.publicaciones drop constraint if exists publicaciones_visibilidad_check;
alter table public.publicaciones add constraint publicaciones_visibilidad_check check (visibilidad in ('privada', 'compartida', 'publica'));

-- Bloqueos (y función para comprobarlos en ambos sentidos sin revelar quién te ha bloqueado)
create table if not exists public.bloqueos (
  bloqueador uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bloqueado uuid not null references auth.users(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (bloqueador, bloqueado), check (bloqueador <> bloqueado)
);
alter table public.bloqueos enable row level security;
create policy "bloqueos: ver los tuyos" on public.bloqueos for select to authenticated using (bloqueador = (select auth.uid()));
create policy "bloqueos: bloquear" on public.bloqueos for insert to authenticated with check (bloqueador = (select auth.uid()));
create policy "bloqueos: desbloquear" on public.bloqueos for delete to authenticated using (bloqueador = (select auth.uid()));

create or replace function public.lumen_bloqueado(otro uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bloqueos b
    where (b.bloqueador = auth.uid() and b.bloqueado = otro) or (b.bloqueador = otro and b.bloqueado = auth.uid()));
$$;
revoke all on function public.lumen_bloqueado(uuid) from public, anon;
grant execute on function public.lumen_bloqueado(uuid) to authenticated;

-- Quién ve una publicación: su autor; seguidores aceptados si está compartida; cualquiera con cuenta si es pública; nunca con bloqueo
drop policy if exists "publicaciones: las tuyas y las compartidas de quien sigues" on public.publicaciones;
drop policy if exists "publicaciones: visibles para ti" on public.publicaciones;
create policy "publicaciones: visibles para ti" on public.publicaciones for select to authenticated
  using (user_id = (select auth.uid())
    or (not public.lumen_bloqueado(user_id) and (
         visibilidad = 'publica'
         or (visibilidad = 'compartida' and public.lumen_puede_ver(user_id)))));

drop policy if exists "fotos: ver las tuyas y las compartidas de quien sigues" on storage.objects;
drop policy if exists "fotos: ver las tuyas y las visibles para ti" on storage.objects;
create policy "fotos: ver las tuyas y las visibles para ti" on storage.objects for select to authenticated
  using (bucket_id = 'publicaciones' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.publicaciones p where p.ruta = storage.objects.name)   -- decide la RLS de publicaciones
  ));

-- Me gusta
create table if not exists public.me_gusta (
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (publicacion_id, user_id)
);
create index if not exists me_gusta_user_idx on public.me_gusta (user_id);
alter table public.me_gusta enable row level security;
create policy "me gusta: de publicaciones que ves" on public.me_gusta for select to authenticated
  using (exists (select 1 from public.publicaciones p where p.id = publicacion_id));
create policy "me gusta: dar" on public.me_gusta for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.publicaciones p where p.id = publicacion_id));
create policy "me gusta: quitar" on public.me_gusta for delete to authenticated using (user_id = (select auth.uid()));

-- Comentarios
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  creado timestamptz not null default now()
);
create index if not exists comentarios_pub_idx on public.comentarios (publicacion_id, creado);
alter table public.comentarios enable row level security;
create policy "comentarios: de publicaciones que ves" on public.comentarios for select to authenticated
  using (exists (select 1 from public.publicaciones p where p.id = publicacion_id) and not public.lumen_bloqueado(user_id));
create policy "comentarios: escribir" on public.comentarios for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.publicaciones p where p.id = publicacion_id));
create policy "comentarios: borrar los tuyos o en tus publicaciones" on public.comentarios for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.publicaciones p where p.id = publicacion_id and p.user_id = (select auth.uid())));

-- Denuncias (solo las ve quien denuncia; se revisan desde el panel de Supabase)
create table if not exists public.denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante uuid not null default auth.uid() references auth.users(id) on delete cascade,
  publicacion_id uuid references public.publicaciones(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  motivo text not null check (char_length(motivo) between 1 and 500),
  creado timestamptz not null default now()
);
alter table public.denuncias enable row level security;
create policy "denuncias: crear" on public.denuncias for insert to authenticated with check (denunciante = (select auth.uid()));
create policy "denuncias: ver las tuyas" on public.denuncias for select to authenticated using (denunciante = (select auth.uid()));

-- Contadores de un perfil (seguidores y seguidos aceptados, publicaciones públicas)
create or replace function public.lumen_contadores(perfil uuid) returns table (seguidores bigint, seguidos bigint, publicaciones bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.seguidores s where s.seguido = perfil and s.estado = 'aceptado'),
    (select count(*) from public.seguidores s where s.seguidor = perfil and s.estado = 'aceptado'),
    (select count(*) from public.publicaciones p where p.user_id = perfil and p.visibilidad = 'publica')
  where auth.uid() is not null and not public.lumen_bloqueado(perfil);
$$;
revoke all on function public.lumen_contadores(uuid) from public, anon;
grant execute on function public.lumen_contadores(uuid) to authenticated;
