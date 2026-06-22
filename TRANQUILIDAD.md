# Índice de tranquilidad del hogar (v1.7)

Documento de entrega de esta evolución. Alcance: **exclusivamente el índice de tranquilidad**,
como agregación sobre lo que ya existía (stock, productos críticos, vencimientos, predicción de
consumo, Supabase). No se tocó modo "Voy al súper", lugares de compra, descuentos, beneficios,
GPS/geolocalización, mapas, inteligencia avanzada ni se agregó ningún modelo de dato complejo
nuevo — quedan en `BACKLOG.md`.

## 1. Archivos modificados

```
src/utils/tranquilidad.js        — NUEVO: calcularTranquilidad() y toda la lógica del índice
src/utils/storage.js             — 3 preferencias nuevas en DEFAULT_PREFERENCES (sin migración
                                    dedicada: loadPreferences() ya hace merge defensivo, mismo
                                    patrón que diasProximoVencimiento en v1.5)
src/data/sampleData.js           — mismas 3 preferencias en SAMPLE_PREFERENCES
src/lib/cloudRepo.js             — mapeo de las 3 columnas nuevas en cargarPreferencias/
                                    guardarPreferenciasCloud (tabla settings)
src/lib/cloudCache.js            — mismos defaults en el fallback de leerCacheCompleta()
src/App.jsx                      — estado inicial de preferencias incluye los 3 campos nuevos
                                    (handleGuardarPreferencias ya era genérico, no se tocó)
src/components/Dashboard.jsx     — calcula el índice (useMemo) y renderiza la tarjeta + modal,
                                    respetando el toggle mostrarTranquilidadDashboard
src/components/Settings.jsx      — sección nueva "🏠 Tranquilidad del hogar" con 3 toggles +
                                    literal de versión actualizado a v1.7
src/index.css                    — estilos nuevos (ver sección 5)
supabase/schema.sql              — 3 columnas nuevas en settings (instalaciones nuevas)
supabase/migration_v5_tranquilidad.sql — NUEVO: migración incremental (proyectos existentes)
```

Componentes nuevos: `src/components/TranquilidadCard.jsx` (tarjeta del Dashboard),
`src/components/TranquilidadDetalle.jsx` (modal de detalle).

## 2. Nueva utilidad creada (`src/utils/tranquilidad.js`)

`calcularTranquilidad(productos, stockItems, eventos, options)` — recibe exactamente lo mismo que
ya recibe `Dashboard.jsx`, no necesita ningún dato nuevo. Devuelve:

```js
{
  puntaje,       // 0-100, o null si no hay productos cargados
  estado,        // { id, label, color } — ej. { id: 'atencion', label: 'Atención', color: 'warn' }
  factores,      // [{ tipo, etiqueta, cantidad, penalizacion, critico }, ...] — auditable
  explicacion,   // ['1 producto crítico agotado', '3 productos agotados', ...] — listo para UI
  positivos,     // ['Sin productos vencidos', ...] — lo que está bien
  detalle        // conteos crudos por categoría, por si se necesitan sin re-parsear texto
}
```

No reescribe ni reemplaza ninguna utilidad existente: importa y consume `getStatus`/
`esProductoCritico` (`stockLogic.js`), `productosVencidos`/`productosProximosAVencer`
(`lotes.js`) y `calcularPrediccion` (`predictions.js`) tal cual están, igual que ya hace
`Dashboard.jsx`.

## 3. Fórmula utilizada

Aditiva y transparente, sin IA/ML, pedida explícitamente así:

```
puntaje = 100 − Σ (penalización fija × cantidad de casos), con clamp [0, 100]
```

Cada situación encontrada resta una cantidad fija de puntos (no hay multiplicadores ocultos, no
hay pesos relativos entre factores más allá de la diferencia crítico/normal). El resultado se
redondea al entero más cercano.

## 4. Factores considerados

| Factor | Normal | Crítico |
|---|---|---|
| Agotado (`STATUS.COMPRAR`) | −4 | −12 |
| Por agotarse (`STATUS.POR_AGOTARSE`) | −2 | −6 |
| Vencido | −3 | −10 |
| Próximo a vencer (umbral configurable, mismo que el resto de la app) | −1.5 | −5 |
| Predicción: se agota en ≤5 días | — (no penaliza individualmente) | −8 |
| Predicción: 3+ productos (cualquiera) se agotan en ≤5 días | −5 (una sola vez) | — |

Las constantes están en `PENALIZACIONES` (exportado), documentadas con un comentario por qué
representa cada una — no son números arbitrarios escondidos en el medio del código.

**Vencimientos y predicción son opcionales** (`options.incluirVencimientos`,
`options.incluirPrediccion`, default `true` ambos): si se apagan desde Ajustes, esos factores
simplemente no se evalúan, el resto del índice se calcula igual.

## 5. Cambios en Dashboard

Tarjeta nueva "🏠 Tranquilidad" (componente `TranquilidadCard`), ubicada como tarjeta principal
justo después del resumen general (OK/Por agotarse/Comprar/Total), antes de cualquier otra
sección. Muestra puntaje, estado con color semántico (verde/amarillo/rojo según el estado),
barra de progreso y hasta 3 motivos principales (con link a "ver detalle" si hay más). Si
`preferencias.mostrarTranquilidadDashboard` es `false`, la tarjeta no se renderiza (verificado en
navegador: se oculta y reaparece correctamente al togglear).

Tocar la tarjeta abre `TranquilidadDetalle` (modal): hero con el puntaje grande, la pregunta
"¿Qué tan abastecido está mi hogar hoy?", sección "Lo que está bien" (factores positivos) y
"Qué está bajando tu tranquilidad" (cada factor con su penalización exacta en puntos), y una nota
final explicando la filosofía del cálculo en una línea.

No se modificó ninguna otra sección del Dashboard (resumen general, productos críticos,
vencimientos, presupuesto, predicciones siguen exactamente igual).

## 6. Cambios en Ajustes

Sección nueva "🏠 Tranquilidad del hogar" con 3 toggles, guardado inmediato al tocar (mismo
patrón que los switches del formulario de producto, sin botón "Guardar" separado — son booleans
simples):

- **Mostrar tarjeta de tranquilidad en Inicio** (`mostrarTranquilidadDashboard`)
- **Incluir predicción de consumo en el cálculo** (`tranquilidadIncluyePrediccion`)
- **Incluir vencimientos en el cálculo** (`tranquilidadIncluyeVencimientos`)

No se expone la fórmula completa para edición (pedido explícito): solo estos 3 interruptores.
Persisten en `preferencias` (local o Supabase según el modo), mismo mecanismo que presupuesto y
umbral de vencimiento.

## 7. Casos borde detectados (y cómo se resolvieron)

- **Hogar sin productos**: matemáticamente el cálculo daría 100 (ninguna penalización aplica),
  pero eso sería engañoso — "Excelente" no tiene sentido sin nada cargado. Se devuelve
  `puntaje: null` y un estado explícito `sin-datos`, con su propio mensaje en la tarjeta y el
  modal ("Agregá productos... / Todavía no hay datos suficientes").
- **Pluralización de frases compuestas**: "producto por agotarse" no pluraliza agregando una
  letra al final ("agotarses" sería incorrecto). Cada factor lleva una forma singular y una
  plural explícitas (`etiquetaSingular`/`etiquetaPlural`), nunca se concatena `'s'` a una frase
  completa. Verificado con pruebas unitarias y en navegador real.
- **Positivo de "críticos OK" engañoso**: si el hogar no tiene ningún producto marcado como
  crítico, no debería aparecer un mensaje de "0 críticos OK" como si fuera un logro — se filtra
  con `totalCriticos > 0` antes de mostrarlo.
- **Productos legacy / campos faltantes**: `esProductoCritico()` ya es defensivo desde v1.6
  (`Boolean(producto?.esCritico)`); reusado tal cual, sin duplicar la defensa.
- **`eventos` undefined**: la sección de predicción solo se evalúa si `Array.isArray(eventos)`;
  si no, el resto del índice se calcula igual, sin explotar.
- **Puntaje fuera de rango**: clamp explícito `Math.max(0, Math.min(100, ...))` antes de
  redondear — probado con 30 productos críticos agotados simultáneos (caso extremo), el puntaje
  queda en 0, no en negativo.
- **Toggle de incluir/excluir factores**: verificado que apagar `incluirVencimientos` o
  `incluirPrediccion` realmente saca esos factores del cálculo (puntaje vuelve a 100 en los casos
  de prueba donde esos eran los únicos factores negativos), no solo los oculta visualmente.
- **Proyecto Supabase sin migrar todavía**: `cargarPreferencias()` usa `data.columna ?? true`
  para las 3 columnas nuevas — si la fila viene de antes de la migración SQL, caen al default
  "activado" (mismo comportamiento que tenía la app sin esta evolución), no a `false`/error.

## 8. Cómo interpretar el índice

- **100 = nada que reportar.** No significa "stock infinito", significa que ningún producto está
  agotado, por agotarse, vencido, próximo a vencer, ni con predicción preocupante.
- **El número siempre se puede explicar.** Cada punto que falta para 100 corresponde a una fila
  exacta en el detalle ("1 producto crítico agotado · −12 puntos"). No hay redondeos ocultos ni
  ajustes manuales — sumar las penalizaciones de los factores siempre da `100 − puntaje`.
- **Los críticos pesan más, a propósito.** Un hogar con 3 productos normales por agotarse (−6)
  puede tener mejor índice que uno con 1 producto crítico agotado (−12) — es la decisión de
  diseño pedida explícitamente ("mayor peso" para críticos).
- **Estados, no solo el número**: Excelente (95-100), Bien (80-94), Atención (60-79), Preocupante
  (40-59), Crítico (0-39) — pensados para que alguien que nunca abrió la app entienda la
  situación de un vistazo, sin tener que interpretar el número.

## 9. Recomendaciones para la siguiente evolución

Quedan en `BACKLOG.md`, sin tocar código:

- **Tendencia ("Subió 4% desde la semana pasada")**: pedido explícitamente no implementar
  todavía. `calcularTranquilidad()` es una función pura sin estado — está lista para que una
  futura evolución guarde snapshots periódicos (tabla nueva, local y/o Supabase) y compare contra
  el puntaje actual, sin tener que tocar esta utilidad.
- **Modo "Voy al súper"**: alternativa más chica del backlog, UX sobre la compra activa existente,
  sin modelo de datos nuevo.
- **Productos críticos en la lista priorizada del índice**: hoy el detalle ordena por
  penalización; si se quisiera, podría linkearse cada factor a su producto específico (hoy son
  agregados por tipo, no por producto individual) — no se hizo porque el pedido pidió un resumen,
  no un listado producto por producto (eso ya existe en Dashboard/Stock/Vencimientos).
