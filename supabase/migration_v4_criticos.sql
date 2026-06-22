-- =========================================================================
-- Stock Hogar — migración incremental: productos críticos
-- =========================================================================
-- Para proyectos de Supabase que YA EXISTÍAN antes de esta evolución. Si tu
-- proyecto es nuevo, no hace falta este archivo: schema.sql ya incluye la
-- columna.
--
-- La más simple de las migraciones hasta ahora: una sola columna nueva,
-- boolean, con default false. No se crean tablas, no se toca ningún otro
-- dato (lotes, eventos, historial, settings quedan intactos), y todos los
-- productos existentes quedan con es_critico = false (ningún producto pasa
-- a ser crítico solo, es 100% configurable por el usuario).
-- =========================================================================

alter table public.products
  add column if not exists es_critico boolean not null default false;
