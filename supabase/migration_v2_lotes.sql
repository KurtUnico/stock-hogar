-- =========================================================================
-- Stock Hogar — migración incremental: lotes y vencimientos
-- =========================================================================
-- Para proyectos de Supabase que YA EXISTÍAN antes de esta evolución (con
-- households/products/etc. ya creados y con datos reales). Si tu proyecto
-- es nuevo, no hace falta este archivo: schema.sql ya incluye todo esto.
--
-- Qué hace, en orden:
--   1. Agrega products.requiere_vencimiento (default false — no afecta
--      productos existentes).
--   2. Crea la tabla stock_items (si no existía).
--   3. Activa RLS + policy de stock_items.
--   4. Si products todavía tiene las columnas viejas cantidad_uso /
--      cantidad_despensa, genera lotes (stock_items) equivalentes a partir
--      de esos valores — UNA SOLA VEZ, de forma idempotente (no duplica si
--      se corre dos veces).
--
-- IMPORTANTE: este script NO borra cantidad_uso/cantidad_despensa de
-- products. Las deja como columnas "muertas" (la app ya no las lee ni las
-- escribe) por seguridad — preferible a un DROP COLUMN irreversible. Si en
-- unas semanas confirmás que todo anda bien, las podés borrar a mano con:
--   alter table public.products drop column cantidad_uso, drop column cantidad_despensa;
-- =========================================================================

-- 1. Columna nueva en products
alter table public.products
  add column if not exists requiere_vencimiento boolean not null default false;

-- 2. Tabla de lotes
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  ubicacion text not null check (ubicacion in ('en_uso', 'despensa')),
  cantidad numeric not null default 0 check (cantidad >= 0),
  fecha_compra timestamptz,
  fecha_vencimiento timestamptz,
  precio_unitario numeric,
  observaciones text,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create index if not exists stock_items_household_idx on public.stock_items(household_id);
create index if not exists stock_items_product_idx on public.stock_items(product_id);
create index if not exists stock_items_vencimiento_idx on public.stock_items(fecha_vencimiento) where activo = true;

-- 3. RLS
alter table public.stock_items enable row level security;

drop policy if exists "stock_items_member" on public.stock_items;
create policy "stock_items_member" on public.stock_items
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

-- 4. Backfill: products.cantidad_uso/cantidad_despensa -> stock_items
-- Solo corre si esas columnas todavía existen (proyectos de antes de esta
-- evolución) y solo para productos que TODAVÍA no tienen ningún stock_item
-- (para no duplicar si este script se corre más de una vez).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'cantidad_uso'
  ) then

    insert into public.stock_items (household_id, product_id, ubicacion, cantidad, fecha_compra, fecha_creacion, fecha_actualizacion)
    select p.household_id, p.id, 'en_uso', p.cantidad_uso, p.ultima_actualizacion, now(), now()
    from public.products p
    where p.cantidad_uso > 0
      and not exists (select 1 from public.stock_items si where si.product_id = p.id);

    insert into public.stock_items (household_id, product_id, ubicacion, cantidad, fecha_compra, fecha_creacion, fecha_actualizacion)
    select p.household_id, p.id, 'despensa', p.cantidad_despensa, p.ultima_actualizacion, now(), now()
    from public.products p
    where p.cantidad_despensa > 0
      and not exists (
        select 1 from public.stock_items si where si.product_id = p.id and si.ubicacion = 'despensa'
      );

  end if;
end $$;
