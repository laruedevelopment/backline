-- Notificaciones push (Web Push): cada dispositivo guarda su suscripción; una función de Supabase (Edge Function
-- `notify-booking`) las lee con la llave de servicio y avisa a la otra parte cuando cambia una reserva. Repetible.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (char_length(user_agent) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_read_own on public.push_subscriptions;
create policy push_read_own on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Guardar o reasignar una suscripción: si el mismo dispositivo cambia de cuenta, pasa a la cuenta actual.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  if (select count(*) from public.push_subscriptions where user_id = (select auth.uid())) >= 10
     and not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint) then
    raise exception 'demasiados dispositivos';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end $$;
revoke all on function public.save_push_subscription from public, anon;
grant execute on function public.save_push_subscription to authenticated;

-- Evita avisar dos veces por el mismo estado de una reserva (la función lo actualiza con la llave de servicio).
alter table public.bookings add column if not exists last_notified_status text;
