-- Perfil público: las cuentas creadas antes del registro de edad no tienen declaración (null). Pueden declararla una sola vez, ellas mismas.
-- Requiere la migración 0007 (columna profiles.age_declaration). Repetible.
create or replace function public.set_profile_public(p_public boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare a text;
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  select age_declaration into a from public.profiles where id = (select auth.uid());
  if p_public and a is null then raise exception 'falta declarar la mayoría de edad'; end if;
  if p_public and a <> 'adult' then raise exception 'solo las personas mayores de edad pueden tener perfil público'; end if;
  update public.profiles set is_public = p_public where id = (select auth.uid());
end $$;
revoke all on function public.set_profile_public from public, anon;
grant execute on function public.set_profile_public to authenticated;

-- Solo sirve si la persona aún no declaró nada: nadie puede cambiar una declaración ya hecha (ni pasar de menor a mayor).
create or replace function public.confirm_adult() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'no autenticado'; end if;
  update public.profiles set age_declaration = 'adult' where id = (select auth.uid()) and age_declaration is null;
end $$;
revoke all on function public.confirm_adult from public, anon;
grant execute on function public.confirm_adult to authenticated;
