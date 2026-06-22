-- =========================================================================
-- Stock Hogar — esquema de Supabase (Postgres)
-- =========================================================================
-- Corré este archivo en el SQL Editor de tu proyecto de Supabase, y después
-- supabase/policies.sql. Pensado para pegarse tal cual, de una.
--
-- Decisiones de diseño (justificadas, ver QA/README para más detalle):
--
-- 1. "categoria" y "unidad" se guardan como TEXT directo en products/items,
--    no como FK a una tabla de catálogo. Hoy la app ya funciona así
--    (strings libres), y categories sí es tabla propia porque el usuario
--    puede agregar categorías nuevas desde la app; unidad es una lista fija
--    de 8 valores que hoy no se edita desde la UI, así que no se justifica
--    todavía una tabla "units" con sus FKs — queda documentado como mejora
--    futura si se permite crear unidades custom.
--
-- 2. "active_purchases" guarda los ítems de la compra en curso como JSONB
--    (un array, igual que hoy en localStorage) en vez de una tabla
--    relacional aparte. Es un "borrador" de trabajo que se descarta o se
--    vuelca a purchase_history/purchase_history_items al cerrar: no vale la
--    pena modelarlo 100% relacional para algo transitorio. Hay como mucho
--    UNA compra activa por hogar (índice único), igual que en la app hoy.
--
-- 3. NO se crean tablas para "stores/purchase_places" ni "benefits/
--    discounts": no existe ese concepto en la app actual y el pedido
--    explícito de esta etapa es no construir funcionalidades nuevas.
--
-- 4. "stock_items" (lotes) es la fuente de verdad del stock físico desde la
--    evolución de lotes/vencimientos. "products" dejó de tener
--    cantidad_uso/cantidad_despensa: ahora es solo catálogo (identidad +
--    mínimo + config). Si tu proyecto YA EXISTÍA antes de esta evolución,
--    no corras este archivo de nuevo tal cual — usá
--    supabase/migration_v2_lotes.sql, que agrega lo nuevo sin tocar tus
--    datos ni borrar las columnas viejas.
-- =========================================================================

create extension if not exists "pgcrypto"; -- para gen_random_uuid()

-- ---------------------------------------------------------------------
-- profiles: extiende auth.users con datos públicos de la app
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- households / household_members
-- ---------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi hogar',
  created_by uuid references auth.users(id) on delete set null,
  migrated_from_local boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx on public.household_members(user_id);

-- ---------------------------------------------------------------------
-- categories (por hogar; el usuario puede agregar nuevas desde la app)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now(),
  unique (household_id, nombre)
);

create index if not exists categories_household_idx on public.categories(household_id);

-- ---------------------------------------------------------------------
-- products (catálogo: identidad + mínimo + config — el STOCK vive en
-- stock_items, no acá; ver más abajo)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  nombre text not null,
  categoria text not null,
  unidad text not null default 'unidad',
  stock_minimo numeric not null default 0 check (stock_minimo >= 0),
  notificacion_activa boolean not null default true,
  requiere_vencimiento boolean not null default false,
  es_critico boolean not null default false,
  ultima_actualizacion timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists products_household_idx on public.products(household_id);

-- ---------------------------------------------------------------------
-- stock_items (lotes): la fuente de verdad del stock físico. Cada fila es
-- una unidad/lote concreto ("este paquete", "esta botella comprada el
-- martes"), con cantidad, ubicación (en_uso | despensa) y vencimiento
-- opcional. El stock total de un producto = suma de cantidad de sus
-- stock_items activos.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- shopping_list_items (ítems manuales de la lista de compras)
-- ---------------------------------------------------------------------
create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  nombre text not null,
  cantidad numeric not null default 1 check (cantidad >= 0),
  comprado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shopping_list_items_household_idx on public.shopping_list_items(household_id);

-- ---------------------------------------------------------------------
-- active_purchases (a lo sumo 1 "abierta" por hogar)
-- ---------------------------------------------------------------------
create table if not exists public.active_purchases (
  household_id uuid primary key references public.households(id) on delete cascade,
  iniciada_en timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- purchase_history / purchase_history_items
-- ---------------------------------------------------------------------
create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  fecha timestamptz not null default now(),
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists purchase_history_household_idx on public.purchase_history(household_id);

create table if not exists public.purchase_history_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_history(id) on delete cascade,
  producto_id uuid references public.products(id) on delete set null,
  nombre text not null,
  categoria text,
  cantidad numeric not null default 0,
  unidad text,
  precio_unitario numeric not null default 0,
  subtotal numeric not null default 0
);

create index if not exists purchase_history_items_purchase_idx on public.purchase_history_items(purchase_id);

-- ---------------------------------------------------------------------
-- stock_events (consumo/movimientos -> alimenta la predicción)
-- ---------------------------------------------------------------------
create table if not exists public.stock_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  producto_id uuid not null references public.products(id) on delete cascade,
  tipo text not null check (tipo in (
    'creacion', 'incremento', 'disminucion', 'compra_cerrada',
    'ajuste_manual', 'agotado', 'agregado_lista'
  )),
  cantidad numeric not null default 0,
  fecha timestamptz not null default now()
);

create index if not exists stock_events_household_idx on public.stock_events(household_id);
create index if not exists stock_events_producto_idx on public.stock_events(producto_id);

-- ---------------------------------------------------------------------
-- settings (1 fila por hogar: presupuesto mensual + moneda)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  presupuesto_mensual numeric not null default 0 check (presupuesto_mensual >= 0),
  moneda text not null default 'UYU',
  dias_proximo_vencimiento integer not null default 30 check (dias_proximo_vencimiento > 0),
  mostrar_tranquilidad_dashboard boolean not null default true,
  tranquilidad_incluye_prediccion boolean not null default true,
  tranquilidad_incluye_vencimientos boolean not null default true,
  dias_para_compra_proxima integer not null default 14 check (dias_para_compra_proxima > 0),
  voy_al_super_incluye_prediccion boolean not null default true,
  voy_al_super_incluye_vencimientos boolean not null default true,
  voy_al_super_incluye_criticos boolean not null default true,
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- Aprovisionamiento automático: al crear un usuario (auth.users), le
-- creamos su profile + un hogar por defecto + lo agregamos como owner +
-- sus categorías de fábrica + su fila de settings. Así "cada usuario tiene
-- al menos un hogar por defecto" sin que la UI tenga que orquestarlo.
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.households (name, created_by)
  values ('Mi hogar', new.id)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  insert into public.settings (household_id)
  values (new_household_id);

  insert into public.categories (household_id, nombre)
  select new_household_id, c
  from unnest(array['Almacén', 'Limpieza', 'Higiene personal', 'Bebé/Niño', 'Otros']) as c;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
