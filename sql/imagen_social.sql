-- Aplicado en Supabase el 2026-10-10 (migraciones lumen_imagen_social y lumen_puede_ver_invoker).
-- Imagen social de Lumen: perfiles públicos, seguidores con aceptación y publicaciones PRIVADAS por defecto.
-- Las fotos viven en el bucket privado "publicaciones": solo se ven con URL firmada si eres el dueño
-- o un seguidor aceptado y la foto está compartida.

create table if not exists public.perfiles_publicos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null unique check (usuario ~ '^[a-z0-9_.]{3,24}$'),
  nombre text check (char_length(nombre) <= 60),
  creado timestamptz not null default now()
);
alter table public.perfiles_publicos enable row level security;
create policy "perfiles: los ve quien ha entrado" on public.perfiles_publicos for select to authenticated using (true);
create policy "perfiles: crear el tuyo" on public.perfiles_publicos for insert to authenticated with check (user_id = (select auth.uid()));
create policy "perfiles: editar el tuyo" on public.perfiles_publicos for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "perfiles: borrar el tuyo" on public.perfiles_publicos for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.seguidores (
  seguidor uuid not null references auth.users(id) on delete cascade,
  seguido uuid not null references auth.users(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptado')),
  creado timestamptz not null default now(),
  primary key (seguidor, seguido),
  check (seguidor <> seguido)
);
create index if not exists seguidores_seguido_idx on public.seguidores (seguido);
alter table public.seguidores enable row level security;
create policy "seguidores: ver los tuyos" on public.seguidores for select to authenticated using ((select auth.uid()) in (seguidor, seguido));
create policy "seguidores: pedir seguir" on public.seguidores for insert to authenticated with check (seguidor = (select auth.uid()) and estado = 'pendiente');
create policy "seguidores: aceptar a quien te sigue" on public.seguidores for update to authenticated using (seguido = (select auth.uid())) with check (seguido = (select auth.uid()));
create policy "seguidores: dejar de seguir o quitar seguidor" on public.seguidores for delete to authenticated using ((select auth.uid()) in (seguidor, seguido));

create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ruta text not null unique,
  descripcion text check (char_length(descripcion) <= 1000),
  carpeta text not null default 'dia' check (carpeta in ('progreso', 'comidas', 'entreno', 'dia', 'otro')),
  visibilidad text not null default 'privada' check (visibilidad in ('privada', 'compartida')),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists publicaciones_user_creado_idx on public.publicaciones (user_id, creado desc);
alter table public.publicaciones enable row level security;

create or replace function public.lumen_puede_ver(autor uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.seguidores s where s.seguidor = auth.uid() and s.seguido = autor and s.estado = 'aceptado');
$$;
revoke all on function public.lumen_puede_ver(uuid) from public, anon;
grant execute on function public.lumen_puede_ver(uuid) to authenticated;

create policy "publicaciones: las tuyas y las compartidas de quien sigues" on public.publicaciones for select to authenticated
  using (user_id = (select auth.uid()) or (visibilidad = 'compartida' and public.lumen_puede_ver(user_id)));
create policy "publicaciones: crear en tu carpeta" on public.publicaciones for insert to authenticated
  with check (user_id = (select auth.uid()) and ruta like ((select auth.uid())::text || '/%'));
create policy "publicaciones: editar las tuyas" on public.publicaciones for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and ruta like ((select auth.uid())::text || '/%'));
create policy "publicaciones: borrar las tuyas" on public.publicaciones for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicaciones', 'publicaciones', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

create policy "fotos: subir a tu carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos: borrar las tuyas" on storage.objects for delete to authenticated
  using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos: ver las tuyas y las compartidas de quien sigues" on storage.objects for select to authenticated
  using (bucket_id = 'publicaciones' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.publicaciones p where p.ruta = storage.objects.name and p.visibilidad = 'compartida' and public.lumen_puede_ver(p.user_id))
  ));
