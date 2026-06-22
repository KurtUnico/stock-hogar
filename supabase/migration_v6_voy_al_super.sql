-- =========================================================================
-- Stock Hogar — migración incremental: modo "Voy al súper"
-- =========================================================================
-- Para proyectos de Supabase que YA EXISTÍAN antes de esta evolución. Si tu
-- proyecto es nuevo, no hace falta este archivo: schema.sql ya incluye las
-- columnas.
--
-- Esta evolución NO agrega tablas nuevas: la propuesta de compra se calcula
-- 100% en el cliente a partir de products + stock_items + stock_events +
-- purchase_history, que ya existían. Lo único nuevo en la base son cuatro
-- columnas de configuración en settings (mismo patrón que v1.7 / índice de
-- tranquilidad): un entero con default razonable y tres booleans con
-- default true (mismo comportamiento que tenía la app antes de que
-- existieran: incluir predicción/vencimientos/críticos en la propuesta).
-- =========================================================================

alter table public.settings
  add column if not exists dias_para_compra_proxima integer not null default 14
  check (dias_para_compra_proxima > 0);

alter table public.settings
  add column if not exists voy_al_super_incluye_prediccion boolean not null default true;

alter table public.settings
  add column if not exists voy_al_super_incluye_vencimientos boolean not null default true;

alter table public.settings
  add column if not exists voy_al_super_incluye_criticos boolean not null default true;
