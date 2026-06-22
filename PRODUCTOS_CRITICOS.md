# Productos críticos (v1.6)

Documento de entrega de esta evolución. Alcance: **exclusivamente productos críticos**, sobre lo
que ya existía (stock, lotes, predicción, inteligencia por vencimiento, Supabase). No se tocó
índice de tranquilidad, modo "Voy al súper", lugares de compra, descuentos, beneficios ni
GPS/geolocalización/mapas — quedan en `BACKLOG.md`.

## 1. Archivos modificados

```
src/utils/stockLogic.js          — NUEVO: esProductoCritico(), obtenerProductosCriticos(),
                                    obtenerResumenCriticos()
src/utils/storage.js             — ensureMigrationV4() (local, agrega esCritico=false)
src/data/sampleData.js           — esCritico: true en pañales/toallitas/leche de la demo
src/lib/cloudRepo.js             — mapeo esCritico <-> es_critico (Supabase <-> JS)
src/App.jsx                      — llama ensureMigrationV4; compra activa copia esCritico
                                    del producto a cada ítem automático
src/components/ProductForm.jsx   — toggle "☑ Producto crítico" + texto explicativo
src/components/ProductCard.jsx   — distintivo "⭐ Crítico" en la tarjeta de stock
src/components/ShoppingListLista.jsx — reordena: críticos-comprar → críticos-por agotarse →
                                    normales-comprar → normales-por agotarse
src/components/ActivePurchase.jsx — ítems críticos destacados (borde lateral + ⭐ en el nombre)
src/components/Dashboard.jsx     — tarjeta "⭐ Productos críticos" (OK/Por agotarse/Comprar) +
                                    prioridad visual en predicciones y en "Para comprar ya"
src/components/PredictionCard.jsx — prop `critico` opcional (default false); no toca el
                                    algoritmo de predictions.js
src/components/VencimientosDetalle.jsx — distintivo "Producto crítico" en vencidos/próximos
src/index.css                    — estilos nuevos (ver sección 6)
supabase/schema.sql              — columna products.es_critico (instalaciones nuevas)
supabase/migration_v4_criticos.sql — NUEVO: migración incremental (proyectos existentes)
```

No se creó ningún componente nuevo: toda la funcionalidad se integró en componentes existentes.

## 2. Modelo de datos

```
Producto.esCritico: boolean   (default: false)
```

Sin reglas automáticas ni categorías precargadas: es 100% configurable por el usuario desde el
formulario de producto. No se agregó ninguna tabla nueva ni se tocó ningún otro campo.

`src/utils/stockLogic.js` agrega tres utilidades puras, para no duplicar lógica en componentes:

- `esProductoCritico(producto)` — `Boolean(producto?.esCritico)`, defensivo ante `null`/
  `undefined`/productos legacy sin el campo.
- `obtenerProductosCriticos(productos)` — filtra la lista completa.
- `obtenerResumenCriticos(productos, stockItems)` — reusa `getResumen()` (ya existente) solo
  sobre los productos críticos, para la tarjeta del Dashboard.

**Importante para el futuro**: todo el resto de la app llama siempre a `esProductoCritico()`,
nunca lee `producto.esCritico` directo. Esto es intencional — preparado para que una futura
evolución a `nivelCriticidad` (mencionada en el pedido, no implementada) solo necesite cambiar
esa función.

## 3. Estrategia de migración

**Local (`ensureMigrationV4` en `utils/storage.js`)**: mismo patrón que `ensureMigrationV2/V3`.
Recorre `products`, agrega `esCritico: p.esCritico ?? false` a cada uno (no pisa el valor si por
algún motivo ya existía), y marca `MIGRATED_V4=true`. Idempotente: si ya corrió, no hace nada.
Instalaciones 100% nuevas nacen con `MIGRATED_V4=true` directo (vía `ensureSeed`), igual que las
migraciones anteriores.

**Supabase (`supabase/migration_v4_criticos.sql`)**: un solo `alter table ... add column if not
exists es_critico boolean not null default false`. No crea tablas, no toca otros datos. Para
proyectos nuevos, `schema.sql` ya incluye la columna.

**Verificado** (ver sección 8): productos sin el campo migran a `false`, una segunda corrida no
pisa un `esCritico: true` que el usuario haya marcado entre medio, y un producto que ya traía el
campo no se pisa.

## 4. Cambios en Dashboard

Tarjeta nueva "⭐ Productos críticos" (solo se muestra si hay al menos un producto marcado),
debajo del resumen general y antes de "Para comprar ya":

```
⭐ Productos críticos

 OK: 1   Por agotarse: 1   Comprar: 1
```

Reusa `obtenerResumenCriticos()` + el mismo layout de estados que el resto de la app (verde/
amarillo/rojo). "Para comprar ya" y "Predicciones" muestran el distintivo ⭐ en los productos
críticos que aparecen ahí, sin cambiar qué productos se listan ni el orden existente de esas
secciones (el pedido no pedía reordenarlas, solo prioridad visual).

## 5. Cambios en Lista de Compras

Orden de prioridad nuevo en `ShoppingListLista.jsx` (antes solo ordenaba "comprar" antes que "por
agotarse"):

```
1. Críticos en Comprar
2. Críticos Por agotarse
3. Normales Comprar
4. Normales Por agotarse
```

Implementado como una función `prioridad(producto)` que devuelve 0-3 y se usa como criterio de
`sort()`, reusando `esProductoCritico()` y `getStatus()` ya existentes — no se reimplementó
ningún criterio de estado. Cada ítem crítico en la lista muestra ⭐ antes del nombre.

En **compra activa**, los ítems críticos se destacan con un borde lateral y ⭐ en el nombre (la
lógica de cantidad/precio/cierre de compra no se tocó).

## 6. Cambios en Predicción

`utils/predictions.js` **no se tocó** (mismo patrón que en v1.4/v1.5: no se reescriben
algoritmos existentes). `PredictionCard.jsx` ahora acepta una prop opcional `critico` (default
`false`) que, si es `true`:
- variant="card" (Dashboard): ícono ⚠️ en vez del de confianza, ⭐ antes del nombre, borde
  lateral.
- variant="box" (detalle de producto): antepone "⚠️ Producto crítico — " al mensaje.

`Dashboard.jsx` y `ProductForm.jsx` pasan `critico={esProductoCritico(producto)}` al renderizar.

## 7. Cambios en Inteligencia por Vencimiento

`utils/wasteIntelligence.js` **no se tocó** (mismo principio: no se reescriben cálculos
existentes). El complemento que ya devuelve (`complementarPrediccion`) se sigue mostrando igual;
lo que cambia es solo la presentación en `ProductForm.jsx`, que antepone "Producto crítico — " en
negrita si corresponde.

`VencimientosDetalle.jsx` (modal de detalle del Dashboard) agrega, en las filas de "Vencidos" y
"Próximos a vencer", una línea "**Producto crítico** ·" cuando el producto lo es, además de ⭐ en
el nombre. Ejemplo real verificado en navegador:

```
⭐ ⏳ Leche
Producto crítico · 2 litro · vence en 3 días
```

## 8. Casos borde detectados (y cómo se resolvieron)

- **Productos legacy sin el campo `esCritico`** (de antes de esta evolución, o llegados por
  Supabase desde un proyecto que no corrió la migración SQL todavía): `esProductoCritico()` usa
  `Boolean(producto?.esCritico)`, que da `false` de forma segura ante `undefined`. Verificado con
  pruebas unitarias y con el caso de `rowAProducto()` recibiendo una fila sin `es_critico`.
- **Ítems manuales en la lista/compra activa** (`productoId: null`, no tienen producto asociado):
  quedan siempre con `esCritico: false` explícito — no pueden ser críticos porque no hay producto
  detrás que lo determine.
- **Idempotencia de la migración**: correrla dos veces no pisa un `esCritico: true` que el
  usuario haya marcado entre la primera y la segunda corrida (verificado).
- **`producto === null`** (ej. `PredictionCard` en el formulario de alta, antes de guardar el
  primer producto): `esProductoCritico(null)` devuelve `false` en vez de tirar error.
- **Tarjeta de críticos en Dashboard con 0 productos críticos**: no se muestra (en vez de mostrar
  0/0/0, que no aporta nada a alguien que todavía no marcó ningún producto).

## 9. Confirmación de funcionamiento

Verificado en navegador real (Playwright + Chromium), sin acceso a red real (ver método en
`HANDOFF.md` sección 11):

- Bundle completo de la app (esbuild, con y sin minificar) compila sin errores ni warnings.
- Migración local probada con 3 escenarios: productos viejos sin el campo, idempotencia, y
  productos que ya traían el campo seteado — los tres se comportan como se esperaba.
- Alta de producto nuevo marcado como crítico → aparece con badge en Stock.
- Edición de producto existente → el toggle refleja el estado guardado y persiste el cambio.
- Lista de compras → orden verificado en pantalla: críticos primero (Pañales, Leche), normales
  después, sin alterar qué productos aparecen.
- Compra activa → ítems críticos destacados visualmente, sin afectar carga de cantidad/precio/
  cierre de compra.
- Dashboard → tarjeta de críticos, predicciones con prioridad visual, resumen general intacto
  (15 productos, mismos números que antes de esta evolución).
- Modal de vencimientos → distintivo "Producto crítico" en la fila correspondiente, sin afectar
  los cálculos de riesgo de desperdicio ni el orden FEFO.
- 0 errores de consola/página en todos los flujos probados.
- SQL de migración revisado: mismo patrón exacto que `migration_v3_inteligencia.sql`, ya probado
  en producción (`alter table ... add column if not exists ... default false`).

## 10. Recomendaciones para la siguiente iteración

Quedan en `BACKLOG.md`, sin tocar código:

- **Índice de tranquilidad del hogar**: ahora puede usar `esCritico` como señal de peso (un
  hogar con críticos en "comprar" debería pesar más que uno con normales en el mismo estado).
  Sigue siendo el candidato más fuerte: no requiere esquema nuevo.
- **"Productos críticos" como filtro en Stock**: hoy `StockList.jsx` ya tiene filtros por estado/
  categoría; un chip "Solo críticos" sería una extensión chica y natural si se quiere en el
  futuro (no se agregó porque no estaba pedido).
- **Notificaciones reforzadas para críticos**: el pedido fue explícito en no tocar el sistema de
  notificaciones (`src/utils/notifications.js`); si en el futuro se quiere, ya hay
  `esProductoCritico()` listo para usar como condición.
- **`nivelCriticidad`**: ver nota técnica agregada en `BACKLOG.md` — el código ya está preparado
  (todo pasa por `esProductoCritico()`), solo faltaría la migración y decidir el mapeo del
  boolean viejo a la nueva escala.
