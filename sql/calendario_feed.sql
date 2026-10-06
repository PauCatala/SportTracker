-- Permite que Google Calendar lea tu calendario de Lumen con tu código secreto.
-- Solo devuelve el calendario exportado (clave "cal-exportar") cuyo código coincide exactamente.
create or replace function public.lumen_calendario_feed(p_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select valor->>'ics'
  from lumen_datos
  where clave = 'cal-exportar'
    and length(p_token) >= 24
    and valor->>'token' = p_token
  limit 1;
$$;
revoke all on function public.lumen_calendario_feed(text) from public;
grant execute on function public.lumen_calendario_feed(text) to anon, authenticated;
