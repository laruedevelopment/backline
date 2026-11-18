-- (1) Denuncias de contenido o de personas; (2) re-aceptar los términos cuando cambia la versión;
-- (3) el destinatario de un mensaje directo puede borrarlo; (4) índice de amistades por quien las envía. Repetible.

-- ───────── Denuncias ─────────
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('profile', 'band', 'message', 'comment', 'dm', 'opening')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'acoso', 'sexual_menores', 'derechos_autor', 'estafa', 'otro')),
  details text check (details is null or char_length(details) <= 500),
  excerpt text check (excerpt is null or char_length(excerpt) <= 300),
  status text not null default 'abierta' check (status in ('abierta', 'revisada', 'descartada')),
  created_at timestamptz not null default now(),
  unique (reporter, kind, target_id)
);
create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;
-- Quien denuncia ve y crea solo las suyas; quien administra Backline las lee desde el panel de Supabase.
drop policy if exists cr_insert on public.content_reports;
create policy cr_insert on public.content_reports for insert to authenticated with check (reporter = (select auth.uid()));
drop policy if exists cr_read on public.content_reports;
create policy cr_read on public.content_reports for select to authenticated using (reporter = (select auth.uid()));
revoke all on public.content_reports from authenticated, anon;
grant select on public.content_reports to authenticated;
grant insert (kind, target_id, reason, details, excerpt) on public.content_reports to authenticated;

-- Freno: máximo 10 denuncias por hora por persona.
create or replace function public.limit_report_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.content_reports where reporter = new.reporter and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'demasiadas denuncias seguidas: espera un rato' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.limit_report_rate from public, anon, authenticated;
drop trigger if exists content_reports_rate on public.content_reports;
create trigger content_reports_rate before insert on public.content_reports for each row execute function public.limit_report_rate();

-- ───────── Términos ─────────
create or replace function public.my_terms_version() returns text
language sql stable security definer set search_path = '' as $$
  select terms_version from public.profiles where id = (select auth.uid());
$$;
create or replace function public.accept_terms(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or p_version is null or char_length(p_version) not between 1 and 20 then raise exception 'solicitud inválida'; end if;
  update public.profiles set accepted_terms_at = now(), terms_version = p_version where id = (select auth.uid());
end $$;
revoke all on function public.my_terms_version, public.accept_terms from public, anon;
grant execute on function public.my_terms_version, public.accept_terms to authenticated;

-- ───────── Mensajes directos: el destinatario también puede borrarlos ─────────
drop policy if exists dm_delete on public.direct_messages;
create policy dm_delete on public.direct_messages for delete to authenticated
  using (sender = (select auth.uid()) or recipient = (select auth.uid()));

-- ───────── Índice ─────────
create index if not exists friendships_requester_idx on public.friendships (requester);
