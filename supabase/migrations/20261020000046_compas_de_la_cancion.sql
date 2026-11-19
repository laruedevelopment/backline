-- Compás de cada canción (4/4, 3/4, 6/8…) para que el pre-conteo del modo escenario cuente bien. Repetible.
alter table public.songs add column if not exists meter text not null default '4/4';
alter table public.songs drop constraint if exists songs_meter_check;
alter table public.songs add constraint songs_meter_check check (meter in ('4/4', '3/4', '2/4', '5/4', '6/8', '7/8', '9/8', '12/8'));
