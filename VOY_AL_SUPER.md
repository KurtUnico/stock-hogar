# Modo "Voy al súper" (v1.8)

Documento de entrega de esta evolución. Alcance: **exclusivamente el modo "Voy al súper"**, como
agregación sobre lo que ya existía (stock, productos críticos, vencimientos, predicción de
consumo, historial de precios, presupuesto, compra activa). No se tocó lugares de compra,
beneficios, descuentos, GPS/geolocalización, mapas, geofencing, inteligencia avanzada ni
comparación de supermercados — quedan en `BACKLOG.md`. No se modificó la lógica de compra activa
existente (`handleIniciarCompraActiva` sigue intacta).

## 1. Archivos modificados

```
src/utils/voyAlSuper.js          — NUEVO: generarPropuestaCompra() y toda la lógica de esta
                                    evolución
src/utils/storage.js             — 4 preferencias nuevas en DEFAULT_PREFERENCES (mismo patrón
                                    sin migración local dedicada que v1.7: loadPreferences() ya
                                    hace merge defensivo)
src/data/sampleData.js           — mismas 4 preferencias en SAMPLE_PREFERENCES
src/lib/cloudRepo.js             — mapeo de las 4 columnas nuevas en cargarPreferencias/
                                    guardarPreferenciasCloud (tabla settings)
src/lib/cloudCache.js            — mismos defaults en el fallback de leerCacheCompleta()
src/App.jsx                      — estado inicial de preferencias incluye los 4 campos nuevos;
                                    handler NUEVO handleIniciarCompraActivaDesdePropuesta (no
                                    toca handleIniciarCompraActiva); wrapper cambiarTab() para
                                    navegación normal vs. navegación directa a "Voy al súper"
src/components/Dashboard.jsx     — calcula la propuesta (useMemo) y renderiza VoyAlSuperCard;
                                    prop nueva onVerVoyAlSuper
src/components/ShoppingList.jsx  — pestaña nueva "Súper" (4ta, junto a Lista/Compra activa/
                                    Historial); prop vistaInicial para saltar directo desde
                                    Dashboard
src/components/Settings.jsx      — sección nueva "🛒 Voy al súper" con 1 input numérico + 3
                                    toggles; literal de versión actualizado a v1.8
src/index.css                    — estilos nuevos (ver sección 5); .segmented__item ajustado
                                    para soportar 4 pestañas en mobile sin desbordar
supabase/schema.sql               — 4 columnas nuevas en settings (instalaciones nuevas)
supabase/migration_v6_voy_al_super.sql — NUEVO: migración incremental (proyectos existentes)
```

Componentes nuevos: `src/components/VoyAlSuper.jsx` (vista completa de la propuesta, dentro de la
pestaña "Súper" en Compras), `src/components/VoyAlSuperCard.jsx` (tarjeta "🛒 Próxima compra" del
Dashboard).

## 2. Nueva utilidad creada (`src/utils/voyAlSuper.js`)

`generarPropuestaCompra(productos, stockItems, eventos, historialCompras, options)` — recibe
exactamente lo mismo que ya recibe el resto de la app (Dashboard, Compras), no necesita ningún
dato nuevo. Devuelve:

```js
{
  urgentes, recomendados, proximos,  // arrays de { producto, motivo, critico, cantidadSugerida,
                                      //   precioEstimado, tienePrecio, subtotalEstimado }
  costoUrgente, costoRecomendado, costoProximo, costoTotal,  // { subtotal, completo, ... }
  totalProductos,
  vacia   // true si no hay nada que comprar
}
```

`calcularImpactoPresupuesto(costoTotalSubtotal, gastadoMes, presupuestoMensual)` — función
separada y reutilizable para el impacto en presupuesto, sin duplicar `getGastoMes`
(`historial.js`): la recibe ya calculada.

No reescribe ninguna utilidad existente: `getStatus`/`esProductoCritico` (`stockLogic.js`),
`productosVencidos`/`productosProximosAVencer` (`lotes.js`), `calcularPrediccion`
(`predictions.js`) y `getHistorialProducto` (`historial.js`) se consumen tal cual están.

## 3. Algoritmo de clasificación

Cada producto pasa por una cadena de reglas en orden de prioridad — la **primera** que aplique
gana (no se acumulan motivos, para que la explicación sea siempre la razón más importante):

**Comprar urgente:**
1. Agotado (`STATUS.COMPRAR`), cualquiera → "Producto agotado." / "Producto crítico agotado."
2. Crítico por agotarse (`STATUS.POR_AGOTARSE` + `esCritico`) → "Producto crítico por agotarse."
3. Vencido **y** estado de stock ya no-OK → "Próximo vencimiento y bajo stock." (lo vencido, en
   la práctica, deja de contar como stock útil — por eso entra a urgente solo si además el stock
   ya está comprometido, no si sobra stock fresco).

**Comprar recomendado:**
4. Por agotarse, no crítico → "Producto por agotarse."
5. Próximo a vencer (con o sin criticidad) → "Próximo a vencer en N días." / versión crítica.
6. Predicción: se agota en ≤ 7 días → "Consumo estimado para los próximos N días."

**Comprar próximamente:**
7. Predicción: se agota en ≤ `diasParaCompraProxima` (default 14, configurable) → mismo mensaje.

**No entra a la propuesta** si nada de lo anterior aplicó — regla pedida explícitamente: "no
mostrar productos con abundante stock, que vencen lejos, o sin necesidad próxima". Una lista
corta y útil, no un volcado de todo el inventario.

Dentro de cada sección, los productos críticos aparecen primero (mismo criterio de prioridad que
la lista de compras desde v1.6).

Las 3 opciones (`incluirPrediccion`, `incluirVencimientos`, `incluirCriticos`) desactivan esas
señales de la clasificación — si se apaga `incluirCriticos`, por ejemplo, un producto crítico por
agotarse pasa a tratarse como uno normal (recomendado, no urgente), y tampoco se reporta como
`critico: true` en el resultado (consistencia: si la señal no influyó, tampoco se muestra).

## 4. Cómo se calcula el costo estimado

Por producto: `precioEstimado × cantidadSugerida`, donde:
- `precioEstimado` = último precio conocido (`getHistorialProducto().ultimoPrecio`) si existe;
  si no, el precio promedio histórico; si no hay ningún precio cargado, **no se inventa un
  precio** — el producto se marca `tienePrecio: false` y no participa del subtotal.
- `cantidadSugerida` = `stockMinimo − stock actual` (mínimo 1) — la misma cuenta que ya usa
  `handleIniciarCompraActiva` para sugerir cantidad.

Por sección: suma de los productos **con precio** únicamente. `completo: true` solo si todos los
productos de la sección tienen precio (igual filosofía que `valorEconomicoCompleto` en
`wasteIntelligence.js` desde v1.5 — nunca se muestra un total parcial disfrazado de total real).

**Compra total sugerida** = urgente + recomendado (lo que tiene sentido comprar ahora).
"Próximamente" es informativo, no se suma al total ni se incluye al crear la compra activa.

**Impacto en presupuesto**: `gastadoMes + costoTotal.subtotal` vs. `presupuestoMensual`. Si no
hay presupuesto configurado (`presupuestoMensual <= 0`), no se calcula "disponible" (queda
`null`) ni se marca que se supera — mismo criterio que `BudgetCard.jsx` ya usaba.

## 5. Cambios en Dashboard

Tarjeta nueva "🛒 Próxima compra" (`VoyAlSuperCard`), debajo de la tarjeta de tranquilidad. Se
oculta sola si la propuesta está vacía (no hay nada para mostrar). Muestra cantidad de
urgentes/recomendados/próximos (solo los que tengan al menos 1) y el costo estimado total, con un
botón "Ver propuesta" que navega a la pestaña "Súper" dentro de Compras.

## 6. Cambios en Compras

Pestaña nueva "🏃 Súper" (acortada a "Súper" en el segmento para que las 4 pestañas entren en
mobile sin desbordar — se ajustó `.segmented__item` de `font-size: 12px` a `11px` con
`text-overflow: ellipsis` como red de seguridad). Vista completa (`VoyAlSuper.jsx`):

- Hero "🛒 Voy al súper" con la explicación de qué se usó para generar la propuesta.
- 3 secciones (urgente/recomendado/próximo), cada una con sus productos, motivo y precio
  estimado — vacías no se muestran.
- Resumen con los 3 subtotales (urgente, recomendado, total sugerido), con aviso si el total es
  parcial por falta de precios.
- Bloque de presupuesto (disponible / compra estimada / aviso si se supera), o un mensaje
  invitando a configurarlo si no existe.
- Botón "🛒 Crear compra activa": toma urgente + recomendado, llama al handler nuevo
  (`handleIniciarCompraActivaDesdePropuesta`) y navega automáticamente a la pestaña "Compra
  activa" para que el usuario vea el resultado de inmediato y pueda seguir editando antes de
  salir (precios prellenados desde el historial, cantidades editables, igual que cualquier compra
  activa). Deshabilitado si ya hay una compra activa en curso, con aviso explicativo.

## 7. Cambios en Ajustes

Sección nueva "🛒 Voy al súper":
- **Días para considerar "compra próxima"** (input numérico + botón "Guardar", mismo patrón que
  el umbral de vencimiento). Default 14.
- **Incluir predicción de consumo** / **Incluir vencimientos** / **Incluir productos críticos**
  (3 toggles, guardado inmediato, mismo patrón que la sección de Tranquilidad de v1.7).

## 8. Casos borde detectados (y cómo se resolvieron)

- **Hogar vacío**: `generarPropuestaCompra([], ...)` devuelve `vacia: true`, todos los subtotales
  en 0 — no explota, la tarjeta del Dashboard no se muestra.
- **Sin historial de precios**: el producto entra a la propuesta igual (la clasificación no
  depende del precio), pero `tienePrecio: false` y no aporta al subtotal — nunca se inventa un
  precio.
- **Sin presupuesto configurado**: la vista muestra un mensaje invitando a configurarlo en vez de
  un bloque de presupuesto en 0 engañoso; `calcularImpactoPresupuesto` devuelve `disponible: null`.
- **Sin productos críticos en el hogar**: ningún item se marca `critico: true`, la clasificación
  funciona igual de bien solo con estado de stock/vencimiento/predicción.
- **Sin productos urgentes**: la sección "Comprar urgente" simplemente no se renderiza (no se
  muestra un encabezado vacío); recomendado/próximo siguen funcionando si corresponde.
- **Producto vencido con MUCHO stock fresco**: no entra a urgente (regla explícita de "no
  abundante stock") — verificado con prueba unitaria dedicada, es el caso borde más sutil del
  algoritmo.
- **Muchos productos (probado con 50)**: no explota, clasifica correctamente, performance
  aceptable (la propuesta se recalcula con `useMemo`, solo cuando cambian sus dependencias).
- **Producto sin predicción** (pocos o ningún evento registrado): `calcularPrediccion` devuelve
  `estado: 'sin-datos'`, la regla de predicción simplemente no aplica — el producto puede seguir
  entrando por estado de stock o vencimiento si corresponde.
- **Producto sin vencimiento** (`requiereVencimiento: false`, sin lotes con fecha): las reglas de
  vencimiento no aplican, el producto se clasifica solo por stock/predicción.
- **Bug real encontrado y corregido durante esta sesión**: al crear la compra activa desde la
  propuesta y navegar a la pestaña "Compra activa", el componente padre (`ShoppingList`) leía el
  prop `compraActiva` para decidir a qué pestaña saltar — pero ese prop todavía reflejaba el
  valor del render anterior justo después de crearla (React no actualiza el closure
  sincrónicamente dentro del mismo evento). Se resolvió agregando un callback explícito
  `onCompraCreada` que `VoyAlSuper` dispara solo cuando la creación fue exitosa, sin depender del
  prop potencialmente desactualizado. Verificado en navegador real: la compra activa se ve
  inmediatamente con los 10 productos esperados y los precios prellenados.

## 9. Confirmación de funcionamiento

Verificado en navegador real (Playwright + Chromium), sin acceso a red real:

- Bundle completo de la app compila sin errores ni warnings.
- 19 pruebas unitarias sobre `generarPropuestaCompra`/`calcularImpactoPresupuesto`, cubriendo
  todos los casos de QA pedidos explícitamente (sin historial de precios, sin presupuesto, sin
  críticos, sin urgentes, hogar vacío, muchos productos, sin predicción, sin vencimiento, y los
  3 toggles de inclusión/exclusión).
- Dashboard → tarjeta "🛒 Próxima compra" con datos reales de la demo (6 urgentes, 4
  recomendados, 1 próximo, estimado $320+).
- Navegación Dashboard → "Ver propuesta" → pestaña "Súper" en Compras, funcionando.
- Vista de propuesta → 3 secciones con motivos correctos ("Producto agotado.", "Producto crítico
  por agotarse.", "Próximo vencimiento y bajo stock.", "Consumo estimado para los próximos 14
  días."), precios y "sin precio" mostrados correctamente, resumen con los 3 subtotales.
- "Crear compra activa" → compra activa creada con los 10 productos correctos (urgente +
  recomendado), precios prellenados desde el historial (verificado: Detergente con $140, el
  último precio conocido), navegación automática a la pestaña correcta.
- Ajustes → sección "🛒 Voy al súper" visible con el input y los 3 toggles funcionando.
- Regresión completa: Dashboard general (15 productos), tranquilidad, productos críticos (3
  badges), vencimientos, presupuesto, predicciones (3), y la lista de compras normal (sin Voy al
  súper) — todo intacto, navegar a Compras sin pasar por "Voy al súper" sigue entrando a "Lista"
  por defecto.
- 0 errores de consola/página en todos los flujos probados (el único 404 es el service-worker, no
  relacionado, esperado en este entorno de test).
- SQL de migración revisado: mismo patrón exacto que `migration_v5_tranquilidad.sql`.

## 10. Recomendaciones para la siguiente evolución

Quedan en `BACKLOG.md`, sin tocar código:

- **Lugares de compra**: con "Voy al súper" ya implementado, encajaría como un filtro adicional
  sobre la propuesta (ej. "productos disponibles en tienda X"), sin tocar
  `generarPropuestaCompra()`.
- **Comparación de supermercados**: dependería de lugares de compra primero.
- **Marcar ítems de la propuesta como "ya los tengo en el changuito"**: hoy la propuesta es de
  solo lectura hasta que se crea la compra activa (donde sí se puede marcar `comprado`); si se
  quisiera interactuar directamente desde la vista de propuesta, sería una extensión de UI sobre
  `VoyAlSuper.jsx`, sin tocar la utilidad.
- **Recordar la última propuesta vista** (para no recalcular al volver): hoy se recalcula siempre
  con `useMemo` sobre datos en vivo — es la fuente de verdad más actual, deliberado así para que
  "Voy al súper" nunca muestre una propuesta vieja.
