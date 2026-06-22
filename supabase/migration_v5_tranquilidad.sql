-- =========================================================================
-- Stock Hogar — migración incremental: índice de tranquilidad del hogar
-- =========================================================================
-- Para proyectos de Supabase que YA EXISTÍAN antes de esta evolución. Si tu
-- proyecto es nuevo, no hace falta este archivo: schema.sql ya incluye las
-- columnas.
--
-- Esta evolución NO agrega tablas nuevas (el índice se calcula 100% en el
-- cliente a partir de products + stock_items + stock_events, que ya
-- existían). Lo único nuevo en la base son tres columnas de configuración
-- en settings, todas boolean con default true (mismo comportamiento que
-- tenía la app antes de que existieran: mostrar la tarjeta e incluir
-- predicción/vencimientos en el cálculo).
-- =========================================================================

alter table public.settings
  add column if not exists mostrar_tranquilidad_dashboard boolean not null default true;

alter table public.settings
  add column if not exists tranquilidad_incluye_prediccion boolean not null default true;

alter table public.settings
  add column if not exists tranquilidad_incluye_vencimientos boolean not null default true;
