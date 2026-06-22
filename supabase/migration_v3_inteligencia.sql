-- =========================================================================
-- Stock Hogar — migración incremental: inteligencia por vencimiento
-- =========================================================================
-- Para proyectos de Supabase que YA EXISTÍAN antes de esta evolución. Si tu
-- proyecto es nuevo, no hace falta este archivo: schema.sql ya incluye la
-- columna.
--
-- Esta evolución NO agrega tablas nuevas (toda la inteligencia se calcula
-- en el cliente a partir de products + stock_items, que ya existían desde
-- la evolución de lotes). Lo único nuevo en la base es una columna de
-- configuración: cuántos días antes se considera "próximo a vencer".
-- =========================================================================

alter table public.settings
  add column if not exists dias_proximo_vencimiento integer not null default 30
  check (dias_proximo_vencimiento > 0);
