# Inteligencia por vencimiento (v1.5)

Documento de entrega de esta evolución. Alcance: **exclusivamente inteligencia por
vencimiento**, sobre lo que ya existía (lotes, FEFO, vencimientos, predicción, Supabase). No se
tocó productos críticos, índice de tranquilidad, lugares de compra, descuentos, beneficios,
GPS/geolocalización, mapas ni modo "Voy al súper" — quedan en `BACKLOG.md`.

## 1. Archivos modificados

```
src/utils/lotes.js                    — productosVencidos/productosProximosAVencer ahora también
                                          devuelven la lista completa de lotes y la cantidad total
                                          (no solo el lote más urgente), sin romper a quien ya las usaba
src/utils/wasteIntelligence.js        — NUEVO: toda la inteligencia de esta evolución
src/utils/storage.js                  — diasProximoVencimiento en preferencias + merge defensivo
                                          al cargar (para no romper preferencias guardadas de antes)
src/data/sampleData.js                — diasProximoVencimiento: 30 en las preferencias de ejemplo
src/lib/cloudRepo.js                  — mapeo de dias_proximo_vencimiento (Supabase <-> JS)
src/lib/cloudCache.js                 — mismo default en la caché local del modo nube
src/components/Settings.jsx           — tarjeta "Vencimientos" con el umbral configurable
src/components/Dashboard.jsx          — tarjeta de riesgo + modal de detalle (ver abajo)
src/components/ProductForm.jsx        — sección "Estado de vencimientos" + recomendación FEFO +
                                          complemento de la predicción
src/components/ActivePurchase.jsx     — nota informativa no bloqueante por ítem
src/components/ShoppingList.jsx       — pasa stockItems a ActivePurchase
src/App.jsx                            — pasa el umbral configurado a ProductForm
src/index.css                          — estilos nuevos (tarjeta, modal, nota en compra activa)
supabase/schema.sql                    — columna settings.dias_proximo_vencimiento (instalaciones nuevas)
supabase/migration_v3_inteligencia.sql — NUEVO: migración incremental (proyectos existentes)
```

Componentes nuevos: `src/components/VencimientosCard.jsx`, `src/components/VencimientosDetalle.jsx`.

## 2. Nuevas utilidades creadas (`src/utils/wasteIntelligence.js`)

Todo centralizado en un solo módulo, construido **sobre** las primitivas que ya existían en
`utils/lotes.js` (FEFO, vencido, próximo a vencer) — nada se duplica en componentes:

- `ordenConsumoRecomendado(productos, stockItems, umbralDias, limite)` — lista "consumir
  primero" entre productos, en el orden pedido: vencidos (más atrasados primero) → próximos a
  vencer (más urgentes primero) → sin vencimiento (lote más antiguo), estos últimos solo como
  relleno si hace falta completar `limite`.
- `calcularRiesgoDesperdicio(productos, stockItems, umbralDias)` — cantidad de productos/
  unidades vencidas y próximas, valor económico (solo de los lotes que tienen `precioUnitario`
  cargado) y una marca `valorEconomicoCompleto` para no mostrar un monto parcial como si fuera el
  total real.
- `recomendacionCompra(producto, stockItems, umbralDias)` / `recomendacionesCompra(...)` — "no
  comprar más X". Solo se genera si el producto **no** necesita reposición (si ya hace falta
  comprarlo, decir "no compres" sería contradictorio) y tiene stock próximo a vencer.
- `notaVencimientoEnCompra(productoId, stockItems, umbralDias)` — versión liviana e
  incondicional (no mira el estado del producto) para mostrar dentro de la compra activa, **solo
  informativa**.
- `complementarPrediccion(producto, prediccion, stockItems, umbralDias)` — combina la predicción
  de consumo existente (sin tocarla) con el vencimiento más próximo: si lo que tenés vence antes
  de que lo consumas al ritmo actual, devuelve un mensaje de riesgo; si no, uno de confirmación.

`productosVencidos` / `productosProximosAVencer` siguen viviendo en `utils/lotes.js` (ya
existían) — se re-exportan desde `wasteIntelligence.js` para que todo lo de vencimientos se
pueda importar desde un solo lugar si se quiere, sin moverlas de archivo innecesariamente.

## 3. Nuevos cálculos agregados

- **Cantidad vencida / próxima por producto**: antes solo se guardaba el lote más urgente; ahora
  `productosVencidos`/`productosProximosAVencer` también devuelven `lotes` (todos los que
  matchean) y `cantidadTotal` (suma), para poder mostrar "2 unidades vencidas" cuando hay más de
  un lote vencido del mismo producto.
- **Riesgo de desperdicio agregado**: unidades vencidas + próximas, y valor económico cuando hay
  precio cargado (si falta precio en algún lote, se avisa que el monto es parcial en vez de
  mostrar un número incompleto como si fuera el total).
- **Umbral configurable**: `diasProximoVencimiento` pasa a vivir en `preferencias` (antes la
  constante `DIAS_PROXIMO_A_VENCER = 30` de `lotes.js` era fija). Sigue siendo el valor por
  defecto en todas las funciones (`umbralDias = DIAS_PROXIMO_A_VENCER`), así que nada se rompe
  para quien no configuró nada.

## 4. Cambios en Dashboard

Se reemplazó la sección inline anterior de "Vencimientos" (que solo listaba hasta 3 ítems sin
más contexto) por:

- **`VencimientosCard`**: vencidos, próximos a vencer y riesgo estimado (monto si hay precios
  cargados, cantidad de unidades si no), con botón "Ver detalles".
- **`VencimientosDetalle`** (modal): listas completas de vencidos y próximos, el orden de
  consumo recomendado (FEFO, hasta 5 productos) y las sugerencias de compra ("no comprar más
  X") que apliquen.

## 5. Cambios en detalle de producto (ProductForm)

Nueva sección **"Estado de vencimientos"** (solo aparece si el producto tiene lotes vencidos o
próximos): cantidad vencida/próxima y una recomendación puntual ("consumir primero el lote que
vence el 15/07"). Además, en el bloque "Más sobre este producto" (donde ya vivía la predicción),
se agrega el mensaje que combina predicción + vencimiento (`complementarPrediccion`), sin
modificar la tarjeta de predicción original.

## 6. Cambios en compra activa

Por cada ítem que tiene un producto vinculado (`productoId`), si ese producto ya tiene stock
próximo a vencer, se muestra una nota informativa ("Ya tenés 3 unidades que vencen en los
próximos 5 días"). **Nunca bloquea**: el botón "Cerrar compra" funciona igual, con o sin estas
notas — verificado en la prueba (sección 8).

## 7. Casos borde detectados y cubiertos

- **Producto sin vencimiento**: todas las funciones devuelven `null`/lo excluyen correctamente
  (no aparece en vencidos/próximos, `complementarPrediccion` devuelve `null`,
  `notaVencimientoEnCompra` devuelve `null`). Probado con Arroz (sin `requiereVencimiento`).
- **Producto con múltiples lotes**: la cantidad se agrega correctamente entre lotes que
  matchean la misma condición (probado con Yogur: 2 lotes, solo uno califica como "próximo",
  `cantidadTotal` refleja solo ese lote, no los 8 totales del producto).
- **Producto vencido**: detectado y priorizado primero en el orden de consumo; si la predicción
  dice que "todavía quedan días de consumo" mientras hay stock ya vencido, el mensaje de
  complemento lo señala explícitamente en vez de mostrar un dato contradictorio.
- **Producto próximo a vencer**: umbral configurable probado en vivo (cambiar de 30 a 7 días
  recalcula el Dashboard y la compra activa sin recargar la página).
- **Producto con precio**: el riesgo económico se calcula correctamente sumando
  `cantidad × precioUnitario` solo de los lotes con precio.
- **Producto sin precio**: el riesgo cae al conteo de unidades; si la situación es mixta (algunos
  lotes con precio, otros sin), se muestra el monto parcial con una aclaración en vez de un
  número falso.
- **Producto sin stock**: `recomendacionCompra` devuelve `null` (no tiene sentido sugerir nada
  sobre algo que no existe en stock).
- **Compra activa**: la nota es informativa únicamente para ítems con `productoId` (los ítems
  manuales sin producto vinculado no generan nota, ya que no hay stock que consultar) y nunca
  bloquea el cierre de la compra.
- **Dashboard**: maneja con normalidad el caso "todo en orden" (tarjeta y modal muestran un
  estado positivo en vez de quedar vacíos o confusos).
- **Sincronización**: el umbral configurable viaja por los mismos caminos que el resto de
  `preferencias` (local, caché de modo nube, Supabase) — no hizo falta tocar la lógica de sync de
  `App.jsx`, ya era genérica para cualquier campo nuevo de preferencias.

## 8. Confirmación de funcionamiento

- **Lógica pura**: las 6 funciones de `wasteIntelligence.js` se probaron con datos construidos a
  mano (vencidos, próximos con varios lotes, con/sin precio, sin vencimiento, sin stock) y los
  resultados coinciden exactamente con lo esperado en cada caso.
- **Integración real en navegador** (Chromium vía Playwright, bundle de la app real): tarjeta de
  Dashboard con el riesgo correcto ($340, verificado a mano contra los lotes de demo), modal de
  detalle con el orden FEFO correcto (el vencido primero), sección de vencimientos en el detalle
  de producto, cambio de umbral en Ajustes recalculando el Dashboard en vivo, nota informativa en
  compra activa sin bloquear el cierre — **0 errores de consola, 0 excepciones**.
- **Build de producción** (esbuild minificado, mismas condiciones que usa Vite): sin errores.
- **Compatibilidad**: no se tocó el algoritmo de predicción (solo se complementa desde afuera),
  no se tocó el criterio FEFO existente (se reutiliza tal cual), y el modo 100% local sigue
  funcionando sin Supabase configurado.
- No se pudo probar contra un proyecto Supabase real (sin acceso a red en este entorno); el
  mapeo de la columna nueva se probó con un cliente simulado. Recomiendo correr
  `supabase/migration_v3_inteligencia.sql` en un proyecto de prueba antes de producción.
