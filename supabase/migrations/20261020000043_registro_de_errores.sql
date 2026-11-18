-- Registro propio de errores de la app (sin terceros): mensaje, pantalla, tipo de dispositivo y quién (para poder ayudarle). Se borra a los 30 días.
-- Solo lo escribe la app con sesión (máx. 20 por hora por persona) y solo lo lee el administrador del proyecto desde el panel de Supabase.
-- Repetible.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  message text not null,
  stack text,
  url text,
  agent text,
  version text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_user_idx on public.client_errors (user_id, created_at desc);
alter table public.client_errors enable row level security; -- sin políticas ni permisos: solo la función y el panel
revoke all on public.client_errors from anon, authenticated;

create or replace function public.log_client_error(p_message text, p_stack text default null, p_url text default null, p_agent text default null, p_version text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or p_message is null or trim(p_message) = '' then return; end if;
  if (select count(*) from public.client_errors where user_id = uid and created_at > now() - interval '1 hour') >= 20 then return; end if;
  insert into public.client_errors (user_id, message, stack, url, agent, version)
  values (uid, left(p_message, 300), left(p_stack, 1500), left(p_url, 200), left(p_agent, 120), left(p_version, 30));
  if random() < 0.02 then delete from public.client_errors where created_at < now() - interval '30 days'; end if;
end $$;
revoke all on function public.log_client_error from public, anon;
grant execute on function public.log_client_error to authenticated;
