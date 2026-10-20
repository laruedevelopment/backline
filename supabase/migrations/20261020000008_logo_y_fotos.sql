-- Logo y fotos de banda (Storage). Bucket público de solo lectura por enlace; escribir solo líder y admins.
-- Límites del bucket: 3 MB por archivo y solo JPEG, PNG o WebP. El cliente además reduce y recodifica la imagen (quita EXIF/GPS).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('band-media', 'band-media', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Rutas: {band_id}/logo-*.ext y {band_id}/photos/*.ext. La primera carpeta decide quién puede escribir.
create policy band_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'band-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_band_admin(((storage.foldername(name))[1])::uuid));
create policy band_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'band-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_band_admin(((storage.foldername(name))[1])::uuid));
-- Listar (para limpiar los archivos al borrar la banda) solo a admins.
create policy band_media_list on storage.objects for select to authenticated
  using (bucket_id = 'band-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_band_admin(((storage.foldername(name))[1])::uuid));

-- Logo
alter table public.bands
  add column logo_path text check (logo_path is null or logo_path like id::text || '/%');
grant update (logo_path) on public.bands to authenticated;

-- Galería (máximo 12 fotos por banda)
create function public.photo_count(b uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.band_photos where band_id = b;
$$;

create table public.band_photos (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  path text not null check (path like band_id::text || '/photos/%'),
  created_at timestamptz not null default now()
);
create index on public.band_photos (band_id, created_at desc);

alter table public.band_photos enable row level security;
create policy photos_read on public.band_photos for select to authenticated using (public.is_band_member(band_id));
create policy photos_insert on public.band_photos for insert to authenticated
  with check (public.is_band_admin(band_id) and public.photo_count(band_id) < 12);
create policy photos_delete on public.band_photos for delete to authenticated using (public.is_band_admin(band_id));

grant select, insert, delete on public.band_photos to authenticated;
revoke all on function public.photo_count from public, anon;
grant execute on function public.photo_count to authenticated;
revoke truncate, references, trigger on public.band_photos from anon, authenticated;
