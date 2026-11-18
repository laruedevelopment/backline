-- Muro (publicaciones, seguidores, me gusta, comentarios) y Mercado (anuncios de equipo, sin pagos dentro de la app). Repetible.
-- Reglas por defecto (recomendadas en la revisión legal):
--   · Publicar, seguir, ver el muro público y el Mercado: solo personas que declararon ser mayores de edad. Una persona menor solo publica para su banda.
--   · Las fotos van a espacios privados: se ven únicamente quienes pueden ver la publicación o el anuncio (enlace firmado).
--   · Backline no cobra ni procesa pagos: el Mercado es un tablón de anuncios con preguntas públicas.
--   · Todo se puede denunciar (content_reports).

-- ───────── Publicaciones ─────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  band_id uuid references public.bands(id) on delete cascade,
  body text check (body is null or char_length(btrim(body)) between 1 and 1500),
  images text[] not null default '{}' check (cardinality(images) <= 4),
  link text check (link is null or (char_length(link) <= 300 and link ~* '^https://(www\.|m\.|music\.)?(youtube\.com|youtu\.be|open\.spotify\.com|spotify\.link)/')),
  visibility text not null default 'friends' check (visibility in ('public', 'friends', 'band')),
  created_at timestamptz not null default now(),
  check (body is not null or cardinality(images) > 0 or link is not null),
  check (visibility <> 'band' or band_id is not null)
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_author_idx on public.posts (author, created_at desc);
create index if not exists posts_band_idx on public.posts (band_id, created_at desc);

create table if not exists public.follows (
  follower uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('band', 'profile')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (follower, target_kind, target_id)
);
create index if not exists follows_target_idx on public.follows (target_kind, target_id);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- ───────── Mercado ─────────
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text check (description is null or char_length(description) <= 1500),
  category text not null check (category in ('guitarra', 'bajo', 'bateria', 'teclado', 'vientos', 'cuerdas', 'amplificador', 'pedal', 'microfono', 'audio', 'accesorios', 'otro')),
  condition text not null check (condition in ('nuevo', 'como_nuevo', 'usado', 'para_reparar')),
  price bigint not null check (price between 0 and 1000000000),
  brand text check (brand is null or char_length(brand) <= 40),
  city text check (city is null or char_length(city) <= 60),
  accepts_trade boolean not null default false,
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9+ ]{7,20}$'),
  images text[] not null default '{}' check (cardinality(images) <= 6),
  status text not null default 'active' check (status in ('active', 'sold', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_active_idx on public.listings (created_at desc) where status = 'active';
create index if not exists listings_seller_idx on public.listings (seller, created_at desc);

create table if not exists public.listing_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  answer text check (answer is null or char_length(btrim(answer)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists listing_questions_listing_idx on public.listing_questions (listing_id, created_at);

alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.listings enable row level security;
alter table public.listing_questions enable row level security;

-- ¿Puedo ver esta publicación / este anuncio? (con los permisos de quien llama: aplica la misma regla de lectura de la tabla)
create or replace function public.can_see_post(p uuid) returns boolean
language sql stable set search_path = '' as $$ select exists (select 1 from public.posts where id = p); $$;
create or replace function public.can_see_listing(l uuid) returns boolean
language sql stable set search_path = '' as $$ select exists (select 1 from public.listings where id = l); $$;
revoke all on function public.can_see_post, public.can_see_listing from public, anon;
grant execute on function public.can_see_post, public.can_see_listing to authenticated;

-- ───────── Políticas: publicaciones ─────────
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (
  author = (select auth.uid())
  or (not public.is_blocked_between(author, (select auth.uid())) and (
       (visibility = 'public' and public.is_adult((select auth.uid())))
       or (visibility = 'friends' and public.are_friends(author, (select auth.uid())))
       or (visibility = 'band' and band_id is not null and public.is_band_member(band_id))))
);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (
  author = (select auth.uid())
  and (band_id is null or public.is_band_admin(band_id))
  and (visibility = 'band' or public.is_adult((select auth.uid())))
  and (visibility <> 'friends' or band_id is null)
);
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author = (select auth.uid())) with check (author = (select auth.uid()));
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (author = (select auth.uid()) or (band_id is not null and public.is_band_admin(band_id)));

drop policy if exists follows_own on public.follows;
create policy follows_own on public.follows for select to authenticated using (follower = (select auth.uid()));
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated with check (
  follower = (select auth.uid()) and public.is_adult((select auth.uid()))
  and ((target_kind = 'band' and exists (select 1 from public.bands b where b.id = target_id and b.is_public))
    or (target_kind = 'profile' and target_id <> (select auth.uid()) and exists (select 1 from public.profiles p where p.id = target_id and p.is_public)))
);
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated using (follower = (select auth.uid()));

drop policy if exists likes_read on public.post_likes;
create policy likes_read on public.post_likes for select to authenticated using (public.can_see_post(post_id));
drop policy if exists likes_insert on public.post_likes;
create policy likes_insert on public.post_likes for insert to authenticated with check (profile_id = (select auth.uid()) and public.can_see_post(post_id));
drop policy if exists likes_delete on public.post_likes;
create policy likes_delete on public.post_likes for delete to authenticated using (profile_id = (select auth.uid()));

drop policy if exists pcomments_read on public.post_comments;
create policy pcomments_read on public.post_comments for select to authenticated using (public.can_see_post(post_id));
drop policy if exists pcomments_insert on public.post_comments;
create policy pcomments_insert on public.post_comments for insert to authenticated
  with check (author = (select auth.uid()) and public.can_see_post(post_id) and public.is_adult((select auth.uid())));
drop policy if exists pcomments_delete on public.post_comments;
create policy pcomments_delete on public.post_comments for delete to authenticated using (
  author = (select auth.uid()) or exists (select 1 from public.posts p where p.id = post_id and p.author = (select auth.uid())));

-- ───────── Políticas: mercado ─────────
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select to authenticated using (
  seller = (select auth.uid())
  or (status = 'active' and public.is_adult((select auth.uid())) and not public.is_blocked_between(seller, (select auth.uid())))
);
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert to authenticated
  with check (seller = (select auth.uid()) and public.is_adult((select auth.uid())));
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update to authenticated
  using (seller = (select auth.uid())) with check (seller = (select auth.uid()));
drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete to authenticated using (seller = (select auth.uid()));

drop policy if exists lq_read on public.listing_questions;
create policy lq_read on public.listing_questions for select to authenticated using (public.can_see_listing(listing_id));
drop policy if exists lq_insert on public.listing_questions;
create policy lq_insert on public.listing_questions for insert to authenticated
  with check (author = (select auth.uid()) and public.can_see_listing(listing_id) and public.is_adult((select auth.uid())));
drop policy if exists lq_answer on public.listing_questions;
create policy lq_answer on public.listing_questions for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller = (select auth.uid())))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller = (select auth.uid())));
drop policy if exists lq_delete on public.listing_questions;
create policy lq_delete on public.listing_questions for delete to authenticated using (
  author = (select auth.uid()) or exists (select 1 from public.listings l where l.id = listing_id and l.seller = (select auth.uid())));

-- ───────── Permisos por columna ─────────
revoke all on public.posts, public.follows, public.post_likes, public.post_comments, public.listings, public.listing_questions from authenticated, anon;
grant select on public.posts, public.follows, public.post_likes, public.post_comments, public.listings, public.listing_questions to authenticated;
grant insert (id, band_id, body, images, link, visibility) on public.posts to authenticated;
grant update (body) on public.posts to authenticated;
grant delete on public.posts, public.follows, public.post_likes, public.post_comments, public.listings, public.listing_questions to authenticated;
grant insert (target_kind, target_id) on public.follows to authenticated;
grant insert (post_id) on public.post_likes to authenticated;
grant insert (post_id, body) on public.post_comments to authenticated;
grant insert (id, title, description, category, condition, price, brand, city, accepts_trade, whatsapp, images) on public.listings to authenticated;
grant update (title, description, category, condition, price, brand, city, accepts_trade, whatsapp, status, updated_at) on public.listings to authenticated;
grant insert (listing_id, body) on public.listing_questions to authenticated;
grant update (answer) on public.listing_questions to authenticated;

-- ───────── Triggers: fecha del servidor, rutas de fotos y frenos ─────────
create or replace function public.check_media_and_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid; n int; img text;
begin
  new.created_at := now();
  if tg_table_name = 'posts' then
    owner := new.author;
    select count(*) into n from public.posts where author = owner and created_at > now() - interval '1 day';
    if n >= 10 then raise exception 'demasiadas publicaciones hoy: intenta mañana' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'listings' then
    owner := new.seller;
    select count(*) into n from public.listings where seller = owner and created_at > now() - interval '1 day';
    if n >= 10 then raise exception 'demasiados anuncios hoy: intenta mañana' using errcode = 'P0001'; end if;
    select count(*) into n from public.listings where seller = owner and status = 'active';
    if n >= 20 then raise exception 'ya tienes 20 anuncios activos' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'post_comments' then
    select count(*) into n from public.post_comments where author = new.author and created_at > now() - interval '1 minute';
    if n >= 20 then raise exception 'demasiados comentarios seguidos: espera un momento' using errcode = 'P0001'; end if;
    return new;
  elsif tg_table_name = 'listing_questions' then
    select count(*) into n from public.listing_questions where author = new.author and created_at > now() - interval '1 minute';
    if n >= 20 then raise exception 'demasiadas preguntas seguidas: espera un momento' using errcode = 'P0001'; end if;
    return new;
  end if;
  -- Las fotos deben estar en la carpeta de quien publica y de esa publicación/anuncio: «{persona}/{id}/archivo».
  foreach img in array new.images loop
    if img not like owner::text || '/' || new.id::text || '/%' or char_length(img) > 200 then raise exception 'ruta de foto inválida'; end if;
  end loop;
  return new;
end $$;
revoke all on function public.check_media_and_rate from public, anon, authenticated;
drop trigger if exists posts_check on public.posts;
create trigger posts_check before insert on public.posts for each row execute function public.check_media_and_rate();
drop trigger if exists listings_check on public.listings;
create trigger listings_check before insert on public.listings for each row execute function public.check_media_and_rate();
drop trigger if exists post_comments_check on public.post_comments;
create trigger post_comments_check before insert on public.post_comments for each row execute function public.check_media_and_rate();
drop trigger if exists listing_questions_check on public.listing_questions;
create trigger listing_questions_check before insert on public.listing_questions for each row execute function public.check_media_and_rate();

-- ───────── Muro «Para ti» y estadísticas ─────────
create or replace function public.feed_for_me(p_limit int default 30, p_before timestamptz default now()) returns setof public.posts
language sql stable set search_path = '' as $$
  select p.* from public.posts p
  where p.created_at < coalesce(p_before, now())
    and (p.author = (select auth.uid())
      or exists (select 1 from public.follows f where f.follower = (select auth.uid())
                 and ((f.target_kind = 'profile' and f.target_id = p.author) or (f.target_kind = 'band' and f.target_id = p.band_id)))
      or public.are_friends(p.author, (select auth.uid()))
      or (p.band_id is not null and public.is_band_member(p.band_id)))
  order by p.created_at desc
  limit least(coalesce(p_limit, 30), 50);
$$;
create or replace function public.post_stats(p_ids uuid[]) returns table (post_id uuid, likes int, comments int, liked boolean)
language sql stable set search_path = '' as $$
  select i,
         (select count(*)::int from public.post_likes l where l.post_id = i),
         (select count(*)::int from public.post_comments c where c.post_id = i),
         exists (select 1 from public.post_likes l where l.post_id = i and l.profile_id = (select auth.uid()))
  from unnest(p_ids[1:50]) as i;
$$;
revoke all on function public.feed_for_me, public.post_stats from public, anon;
grant execute on function public.feed_for_me, public.post_stats to authenticated;

-- ───────── Denuncias: también publicaciones, comentarios y anuncios ─────────
alter table public.content_reports drop constraint if exists content_reports_kind_check;
alter table public.content_reports add constraint content_reports_kind_check
  check (kind in ('profile', 'band', 'message', 'comment', 'dm', 'opening', 'post', 'post_comment', 'listing', 'listing_question'));

-- ───────── Espacios privados para fotos ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-media', 'feed-media', false, 2097152, array['image/webp', 'image/jpeg', 'image/png']),
       ('market-media', 'market-media', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Cada quien sube y borra en su carpeta ({su id}/{id de la publicación o anuncio}/archivo).
-- Ve la foto quien puede ver la publicación o el anuncio (o es su dueño): las fotos no son públicas por enlace.
drop policy if exists feed_media_insert on storage.objects;
create policy feed_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'feed-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists feed_media_delete on storage.objects;
create policy feed_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'feed-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists feed_media_read on storage.objects;
create policy feed_media_read on storage.objects for select to authenticated using (
  bucket_id = 'feed-media' and ((storage.foldername(name))[1] = (select auth.uid())::text
    or ((storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' and public.can_see_post(((storage.foldername(name))[2])::uuid))));

drop policy if exists market_media_insert on storage.objects;
create policy market_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'market-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists market_media_delete on storage.objects;
create policy market_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'market-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists market_media_read on storage.objects;
create policy market_media_read on storage.objects for select to authenticated using (
  bucket_id = 'market-media' and ((storage.foldername(name))[1] = (select auth.uid())::text
    or ((storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' and public.can_see_listing(((storage.foldername(name))[2])::uuid))));

-- ───────── Tarjetas de personas (nombre y foto) para el muro y el mercado ─────────
-- Devuelve solo nombre y foto, y solo de personas que quien llama ya puede conocer: ella misma, perfiles públicos, su banda, sus amigos,
-- quienes publican o comentan en lo que puede ver, y quienes venden o preguntan en anuncios activos.
create or replace function public.profile_cards(p_ids uuid[]) returns table (id uuid, display_name text, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_path
  from public.profiles p
  where p.id = any (p_ids[1:60])
    and ((select auth.uid()) is not null)
    and (p.id = (select auth.uid()) or p.is_public
      or public.shares_band((select auth.uid()), p.id) or public.are_friends((select auth.uid()), p.id)
      or exists (select 1 from public.posts x where (x.author = p.id)
                 and not public.is_blocked_between(x.author, (select auth.uid()))
                 and ((x.visibility = 'public' and public.is_adult((select auth.uid())))
                      or (x.visibility = 'friends' and public.are_friends(x.author, (select auth.uid())))
                      or (x.visibility = 'band' and x.band_id is not null and public.is_band_member(x.band_id))))
      or exists (select 1 from public.post_comments c join public.posts x on x.id = c.post_id where c.author = p.id
                 and ((x.author = (select auth.uid()))
                      or (not public.is_blocked_between(x.author, (select auth.uid()))
                          and ((x.visibility = 'public' and public.is_adult((select auth.uid())))
                               or (x.visibility = 'friends' and public.are_friends(x.author, (select auth.uid())))
                               or (x.visibility = 'band' and x.band_id is not null and public.is_band_member(x.band_id))))))
      or exists (select 1 from public.listings l where l.seller = p.id and l.status = 'active' and public.is_adult((select auth.uid())))
      or exists (select 1 from public.listing_questions q join public.listings l on l.id = q.listing_id where q.author = p.id
                 and ((l.seller = (select auth.uid())) or (l.status = 'active' and public.is_adult((select auth.uid()))))));
$$;
revoke all on function public.profile_cards from public, anon;
grant execute on function public.profile_cards to authenticated;
