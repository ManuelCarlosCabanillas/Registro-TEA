-- Esquema Supabase — modelo "código de familia" (prototipo)
-- Ejecutar en: Supabase → SQL Editor → New query → pegar → Run

-- 1) Tabla: una fila por familia con todo el registro (JSON)
create table if not exists public.households (
  family_code text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) Bloquear acceso directo a la tabla desde la app (RLS sin políticas = denegado)
alter table public.households enable row level security;

-- 3) Función para LEER los datos de una familia (hay que conocer su código)
create or replace function public.get_household(p_code text)
returns setof public.households
language sql
security definer
set search_path = public
as $$
  select * from public.households where family_code = p_code;
$$;

-- 4) Función para GUARDAR (crear o actualizar) los datos de una familia
create or replace function public.save_household(p_code text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_ts timestamptz;
begin
  insert into public.households (family_code, data, updated_at)
  values (p_code, p_data, now())
  on conflict (family_code) do update set data = excluded.data, updated_at = now()
  returning updated_at into v_ts;
  return v_ts;
end;
$$;

-- 5) Permitir que la app (rol anónimo) llame SOLO a estas funciones
grant execute on function public.get_household(text) to anon;
grant execute on function public.save_household(text, jsonb) to anon;
