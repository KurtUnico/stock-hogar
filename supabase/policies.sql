-- =========================================================================
-- Stock Hogar — Row Level Security
-- =========================================================================
-- Correr DESPUÉS de schema.sql. Regla general en toda la base: un usuario
-- solo puede leer/escribir filas de hogares (household_id) donde figura en
-- household_members. No hay accesos "de admin" desde el cliente: todo pasa
-- por esta regla, así que da igual cuántos hogares tenga un usuario en el
-- futuro (hoy: exactamente uno, el que crea el trigger al registrarse).
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_items enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.active_purchases enable row level security;
alter table public.purchase_history enable row level security;
alter table public.purchase_history_items enable row level security;
alter table public.stock_events enable row level security;
alter table public.settings enable row level security;

-- ---------------------------------------------------------------------
-- profiles: cada quien ve y edita SOLO su propio perfil.
-- El insert lo hace el trigger handle_new_user() con security definer,
-- así que no hace falta (ni conviene) una policy de insert para el cliente.
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- ---------------------------------------------------------------------
-- households: visible y editable para sus miembros.
-- ---------------------------------------------------------------------
drop policy if exists "households_select_member" on public.households;
create policy "households_select_member" on public.households
  for select using (
    id in (select household_id from public.household_members where user_id = auth.uid())
  );

drop policy if exists "households_update_member" on public.households;
create policy "households_update_member" on public.households
  for update using (
    id in (select household_id from public.household_members where user_id = auth.uid())
  );

-- (No hay policy de insert/delete para households desde el cliente: hoy se
-- crean únicamente vía el trigger de signup. Si más adelante se permite
-- crear hogares adicionales o eliminarlos desde la UI, agregar acá.)

-- (No hay policy de update/delete adicional para households desde el
-- cliente más allá de la de arriba. Sí agregamos INSERT acotado a "vos
-- mismo": lo usa el fallback de resolverHogar() en cloudRepo.js, por si el
-- trigger de signup no llegó a correr.)
drop policy if exists "households_insert_self" on public.households;
create policy "households_insert_self" on public.households
  for insert with check (created_by = auth.uid());

drop policy if exists "household_members_insert_self" on public.household_members;
create policy "household_members_insert_self" on public.household_members
  for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- household_members: un miembro puede ver la lista de sus co-miembros
-- (preparado para cuando se sume "invitar a otra persona al hogar").
-- ---------------------------------------------------------------------
drop policy if exists "household_members_select_member" on public.household_members;
create policy "household_members_select_member" on public.household_members
  for select using (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Tablas de datos del hogar: mismo patrón "for all" (select/insert/
-- update/delete) condicionado a household_id en mis hogares.
-- ---------------------------------------------------------------------
drop policy if exists "categories_member" on public.categories;
create policy "categories_member" on public.categories
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "products_member" on public.products;
create policy "products_member" on public.products
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "stock_items_member" on public.stock_items;
create policy "stock_items_member" on public.stock_items
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "shopping_list_items_member" on public.shopping_list_items;
create policy "shopping_list_items_member" on public.shopping_list_items
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "active_purchases_member" on public.active_purchases;
create policy "active_purchases_member" on public.active_purchases
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "purchase_history_member" on public.purchase_history;
create policy "purchase_history_member" on public.purchase_history
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "stock_events_member" on public.stock_events;
create policy "stock_events_member" on public.stock_events
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "settings_member" on public.settings;
create policy "settings_member" on public.settings
  for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- purchase_history_items: no tiene household_id propio; se valida a
-- través de purchase_id -> purchase_history.household_id.
-- ---------------------------------------------------------------------
drop policy if exists "purchase_history_items_member" on public.purchase_history_items;
create policy "purchase_history_items_member" on public.purchase_history_items
  for all
  using (
    purchase_id in (
      select id from public.purchase_history
      where household_id in (select household_id from public.household_members where user_id = auth.uid())
    )
  )
  with check (
    purchase_id in (
      select id from public.purchase_history
      where household_id in (select household_id from public.household_members where user_id = auth.uid())
    )
  );
