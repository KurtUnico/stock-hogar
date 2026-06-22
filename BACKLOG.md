# Backlog futuro (no implementado todavía)

Documentado a pedido, para tenerlo presente en próximas iteraciones. Nada de esto está
implementado en la versión actual:

- ~~Login de usuarios.~~ ~~Recuperación de contraseña.~~ ~~Sincronización con Supabase.~~
  → **Implementado en v1.3** (auth, hogar por defecto, sync básica con Supabase). Ver
  `SUPABASE_SETUP.md`.
- ~~Stock por lotes/unidades físicas.~~ ~~Vencimientos.~~ ~~FEFO.~~
  → **Implementado en v1.4** (entidad `StockItem`, predicción de vencimiento, orden FEFO). Ver
  el modelo de datos al final de este archivo y la sección correspondiente del README.
- ~~Riesgo de desperdicio.~~ ~~Recomendaciones FEFO entre productos.~~ ~~Recomendaciones de
  compra basadas en vencimiento.~~
  → **Implementado en v1.5**. Ver `VENCIMIENTOS_INTELIGENCIA.md`.
- ~~Productos críticos (marcar un producto como "no puede faltar nunca", con alertas reforzadas).~~
  → **Implementado en v1.6** (campo `esCritico` boolean, configurable, sin reglas automáticas).
  Ver `PRODUCTOS_CRITICOS.md`.
- ~~Índice de tranquilidad del hogar (puntaje agregado de qué tan cubierto está el stock).~~
  → **Implementado en v1.7** (`calcularTranquilidad()`, 0-100, sin IA/ML, totalmente explicable).
  Ver `TRANQUILIDAD.md`.
- ~~Modo "Voy al súper" (vista dedicada tipo lista de compras optimizada para usar parado en el
  pasillo del supermercado — distinto de la compra activa actual).~~
  → **Implementado en v1.8** (`generarPropuestaCompra()`: urgente/recomendado/próximo, con costo
  estimado e impacto en presupuesto). Ver `VOY_AL_SUPER.md`.
- Lugares de compra / tiendas asociadas a cada compra o producto.
- Descuentos y beneficios (cupones, promociones por tienda o medio de pago).
- GPS / geolocalización (sugerir comprar al pasar cerca de un supermercado, etc.).
- Mapas (visualizar tiendas, rutas de compra).
- Login social (Google, Apple, etc.) — hoy solo email + contraseña.
- Sincronización en tiempo real entre dispositivos (Supabase Realtime). Hoy se sincroniza al
  cargar la app y al reconectar, no mientras dos dispositivos están online simultáneamente.
- Resolución de conflictos real para ediciones concurrentes desde dos dispositivos offline al
  mismo tiempo (hoy: "gana" quien reconecta último, para las entidades que se reescriben
  completas). Ver limitaciones en `SUPABASE_SETUP.md`.
- Hogares compartidos *activamente usados* por varias personas a la vez (el modelo de datos ya
  está preparado — tabla `household_members` — pero no hay UI para invitar a otra persona).
- Invitación de familiares al hogar.
- Push notifications reales con backend (hoy son locales/simuladas — ver `public/service-worker.js`
  y `src/utils/notifications.js`, que ya dejan la estructura preparada).
- Escaneo de código de barras para alta rápida de productos.
- Comparación de precios entre supermercados.
- Exportar historial a Excel.
- Estadísticas avanzadas (gráficos de gasto por categoría, tendencias, etc.).
- Tendencia del índice de tranquilidad ("Subió 4% desde la semana pasada"). Pedido explícitamente
  no implementar todavía, pero `calcularTranquilidad()` está diseñada para poder agregarse sin
  romper su forma actual — ver nota técnica abajo.

## Notas para cuando se implemente cada una

- **Realtime**: Supabase permite suscribirse a cambios de Postgres por tabla/hogar
  (`supabase.channel(...).on('postgres_changes', ...)`). El `household_id` ya está en todas las
  tablas, así que el filtro de suscripción es directo.
- **Invitar a otra persona al hogar**: falta UI + una policy de `insert` en `household_members`
  acotada (hoy solo se inserta uno mismo, ver `supabase/policies.sql`) + algún mecanismo de
  invitación (link/código). El resto del modelo ya soporta varios miembros por hogar.
- **Push real**: `public/service-worker.js` tiene el listener de `push` comentado y listo;
  solo falta backend + claves VAPID + guardar la suscripción de `pushManager.subscribe(...)`.
- **Comparación de precios entre supermercados**: `purchase_history` podría extenderse con un
  campo `tienda`/`store_id` sin romper lo existente (campo opcional).
- **Lugares de compra**: podría ser una tabla `stores` (household_id, nombre, ubicación opcional)
  referenciada desde `purchase_history` y/o `stock_items.fecha_compra` — no se creó en esta etapa
  porque no existe el concepto en la app todavía. Con "Voy al súper" ya implementado, encajaría
  naturalmente como un filtro adicional sobre `generarPropuestaCompra()` (ej. "productos
  disponibles en tienda X"), sin tocar la utilidad existente.
- **Comparación de supermercados**: mencionado explícitamente como fuera de alcance en la
  evolución "Voy al súper". Dependería de #lugares de compra — sin esa tabla no hay "por
  supermercado" que comparar.
- **Nivel de criticidad** (reemplazar `esCritico` boolean por una escala, ej. `nivelCriticidad`
  1-3): el código ya está preparado para esto — todo el resto de la app consume
  `esProductoCritico()` (`utils/stockLogic.js`), nunca lee `producto.esCritico` directo, así que
  el día de mañana alcanza con cambiar esa función para que interprete el nuevo campo. Requeriría
  migración (`ensureMigrationV5` + `migration_v5_*.sql`) y decidir cómo migrar el boolean viejo
  (ej. `true` -> nivel 2, `false` -> nivel 0).
- **Tendencia del índice de tranquilidad**: `calcularTranquilidad()` (`utils/tranquilidad.js`) es
  una función pura sin estado — no guarda nada por su cuenta. Para la tendencia haría falta: (1)
  una tabla `tranquilidad_historico` (local: nueva clave en storage.js; nube: tabla nueva con
  `household_id`, `puntaje`, `fecha`) que guarde un snapshot periódico (ej. al cerrar el día, o al
  abrir la app si pasó más de N horas desde el último snapshot), y (2) una función nueva
  `compararConHistorico(puntajeActual, historico)` que NO modifique `calcularTranquilidad()` —
  se construiría al lado, leyendo su resultado. No se creó la tabla en esta etapa porque el
  pedido fue explícito en no implementar histórico todavía.
