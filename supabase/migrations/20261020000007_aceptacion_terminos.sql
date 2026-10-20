-- Registro de aceptación de términos, política y declaración de edad (Ley 1581: prueba de la autorización).
-- Se llena al crear la cuenta, desde los metadatos que manda el formulario de registro.

alter table public.profiles
  add column accepted_terms_at timestamptz,
  add column terms_version text check (char_length(terms_version) <= 20),
  add column age_declaration text check (age_declaration in ('adult', 'minor_with_consent'));
-- Sin grant de update para estas columnas: el usuario no puede reescribirlas.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v text := left(new.raw_user_meta_data ->> 'terms_version', 20);
  a text := new.raw_user_meta_data ->> 'age_declaration';
begin
  insert into public.profiles (id, display_name, accepted_terms_at, terms_version, age_declaration)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'name', 60), ''),
    case when v is not null then now() end,
    v,
    case when a in ('adult', 'minor_with_consent') then a end
  );
  return new;
end $$;
