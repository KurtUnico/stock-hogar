# Lotes y vencimientos (v1.4)

Documento de entrega de esta evolución: modelo de datos, estrategia de migración, riesgos
detectados y casos pendientes. Alcance: **exclusivamente lotes y vencimientos** — no se tocó
nada de productos críticos, índice de tranquilidad, lugares de compra, descuentos, beneficios,
GPS/geolocalización ni mapas (quedan en `BACKLOG.md`, sin implementar a propósito).

## 1. Qué cambia conceptualmente

Antes: cada producto tenía dos números (`cantidadUso`, `cantidadDespensa`). El stock total era
la suma de esos dos números.

Ahora: cada producto es solo **catálogo** (nombre, categoría, unidad, mínimo, si requiere
vencimiento). El stock real vive en una entidad nueva, **`StockItem` (lote)**: unidades físicas
concretas — "este paquete de fideos", "esta botella de leche comprada el martes que vence el
15" — cada una con su propia cantidad, ubicación y vencimiento opcional. El stock de un producto
es la suma de sus lotes activos.

## 2. Modelo de datos

### Producto (cambios)

```
{
  id, nombre, categoria, unidad, stockMinimo, notificacionActiva,
  requiereVencimiento: boolean,   // NUEVO
  ultimaActualizacion
}
```

`cantidadUso` y `cantidadDespensa` **ya no existen** en el producto (se eliminan en la
migración, ver más abajo). El stock se calcula siempre a partir de los lotes.

### StockItem (lote) — entidad nueva

```
{
  id,
  productId,
  ubicacion: 'en_uso' | 'despensa',
  cantidad,
  fechaCompra,          // ISO o null
  fechaVencimiento,      // ISO o null — SIEMPRE opcional, incluso si requiereVencimiento=true
  precioUnitario,         // o null
  observaciones,           // o null
  activo: boolean,         // false = consumido/desactivado (no se borra al llegar a 0, se conserva como referencia liviana)
  fechaCreacion, fechaActualizacion
}
```

Definido en `src/utils/lotes.js` (`crearLote`, además de toda la inteligencia de vencimientos).

### Dónde vive cada cosa

| Capa | Dato |
|---|---|
| `localStorage` (modo sin cuenta) | clave nueva `stockhogar_stock_items` (ver `src/utils/storage.js`) |
| Caché local del modo nube | clave nueva `stockhogar_cache_stock_items` (ver `src/lib/cloudCache.js`) |
| Supabase | tabla nueva `stock_items`, FK a `products` con `ON DELETE CASCADE` (ver `supabase/schema.sql`) |

## 3. Cálculo de stock (toda la app)

Centralizado en `src/utils/stockLogic.js`:

- `getStockProducto(producto, stockItems)` → `{ enUso, enDespensa, total }`, sumando los lotes
  activos de ese producto por ubicación.
- `getTotal`, `getStatus`, `getNivelPorcentaje`, `getResumen`, `debeComprarse` ahora reciben
  `stockItems` como segundo parámetro. **Ningún componente lee más `producto.cantidadUso` ni
  `producto.cantidadDespensa`** — se verificó con una búsqueda en todo `src/` (ver sección 7).

## 4. FEFO e inteligencia de vencimientos (`src/utils/lotes.js`)

- `ordenarFEFO(lotes)`: vencen antes → vencen después → sin vencimiento al final (los sin
  vencimiento se ordenan entre sí por fecha de creación, más viejo primero).
- `proximoVencimiento(lotes)`: la fecha más próxima entre los lotes activos de un producto.
- `estaVencido` / `estaProximoAVencer` (umbral inicial: 30 días, `DIAS_PROXIMO_A_VENCER`).
- `productosVencidos` / `productosProximosAVencer`: listas para el Dashboard, una entrada por
  producto (el lote más urgente de cada uno).
- **Botones rápidos +/- de Stock**: "+1" suma a un lote genérico sin vencimiento de esa
  ubicación (o crea uno si no existe); "-1" aplica FEFO de verdad — descuenta del lote que vence
  antes entre los que tienen stock, y si ninguno tiene vencimiento, del más viejo
  (`incrementarGenerico` / `consumirFEFO`).
- **Gestión fina** (cargar vencimiento, mover, eliminar, consumir un lote puntual): sección
  "Lotes" en el detalle del producto (`LotesManager.jsx`), con los lotes siempre listados en
  orden FEFO.

## 5. Compra activa y cierre de compra

Al cerrar una compra, **se crean lotes nuevos** por cada producto comprado (no se incrementa un
contador). Si el producto tiene `requiereVencimiento`, la compra activa muestra un campo de
fecha opcional por ítem (con aviso en el resumen si quedó sin completar, pero **nunca bloquea**
cerrar la compra). El lote nuevo hereda esa fecha si se cargó.

## 6. Predicción de consumo

**No se reescribió el algoritmo**, tal como se pidió. `calcularPrediccion(producto, eventos,
stockItems)` solo cambió de dónde lee el stock actual (ahora vía `getTotal(producto,
stockItems)` en vez de `producto.cantidadUso + producto.cantidadDespensa`). La lógica de
consumo/confianza es exactamente la misma.

## 7. Estrategia de migración (sin perder datos)

### localStorage (modo sin cuenta)

`ensureMigrationV3()` en `src/utils/storage.js`, se ejecuta una vez por dispositivo:

1. Si ya corrió (`stockhogar_migrated_v3 = true`), no hace nada.
2. Si no, recorre `stockhogar_products`: por cada producto con `cantidadUso > 0` crea un lote
   `en_uso`; con `cantidadDespensa > 0`, un lote `despensa` — ambos **sin vencimiento** (esa
   información nunca existió). Después saca `cantidadUso`/`cantidadDespensa` del objeto
   producto y agrega `requiereVencimiento: false` si no estaba.
3. Idempotente: si por algún motivo ya hay `stock_items` guardados pero el flag se perdió, no
   regenera nada (evita duplicar lotes).
4. Instalaciones 100% nuevas nacen directo con `ensureSeed()` poblando lotes de ejemplo — nunca
   pasan por esta migración.

Ejemplo del enunciado (Yerba, uso=1, despensa=2) verificado manualmente con el motor de
migración: produce exactamente un lote `en_uso` cantidad 1 y un lote `despensa` cantidad 2, sin
vencimiento — igual a lo pedido.

### Supabase

Dos casos:

- **Proyecto nuevo**: `supabase/schema.sql` ya crea `products` sin las columnas viejas y la
  tabla `stock_items` directamente. No hace falta migrar nada.
- **Proyecto ya existente** (con datos reales de antes de esta evolución): correr
  `supabase/migration_v2_lotes.sql`. Hace, en este orden: agrega `products.requiere_vencimiento`
  (default `false`, no toca filas existentes), crea `stock_items` + RLS, y **si** la tabla
  `products` todavía tiene las columnas `cantidad_uso`/`cantidad_despensa`, genera los lotes
  equivalentes — con un `where not exists (...)` que lo hace seguro de correr más de una vez sin
  duplicar.
- **Importante**: ese script **no borra** `cantidad_uso`/`cantidad_despensa` de `products`. Las
  deja como columnas sin uso (la app ya no las lee ni las escribe) en vez de un `DROP COLUMN`
  irreversible. El archivo incluye, comentado, el SQL para borrarlas a mano más adelante si se
  confirma que todo anda bien.
- **Migración local → nube** (`src/lib/migration.js`, cuando alguien inicia sesión por primera
  vez con datos locales reales): ahora también sube `stockItems`, con la misma lógica de "esto
  es del demo, esto es real" ya usada para historial/eventos (ids con prefijo `demo_lote_`
  quedan afuera).

### Compatibilidad hacia atrás

Quien tenga la app abierta en una pestaña vieja (código anterior a esta evolución) mientras se
actualiza no es un escenario soportado — es una PWA de uso personal/familiar, no un sistema con
múltiples versiones de cliente conviviendo. Al recargar, toma el código nuevo y migra.

## 8. Riesgos detectados

- **Riesgo bajo, mitigado**: pérdida de datos durante la migración. Mitigado con: migración
  idempotente (no corre dos veces), generación de lotes verificada contra el ejemplo del
  enunciado, y que el SQL de Supabase nunca borra columnas existentes.
- **Riesgo medio, aceptado conscientemente**: en Supabase, si el desarrollador corre
  `schema.sql` completo sobre un proyecto que ya tenía datos (en vez de
  `migration_v2_lotes.sql`), `create table if not exists` no rompe nada porque no vuelve a crear
  `products` — pero tampoco migra los datos viejos a lotes. Por eso `schema.sql` tiene una nota
  explícita arriba de la definición de `products` advirtiendo cuál de los dos correr. No se
  puede evitar este riesgo por software (depende de qué archivo ejecuta la persona), solo
  documentarlo con claridad — y así se hizo.
- **Riesgo bajo**: el botón "-1" rápido ahora aplica FEFO automáticamente. Si alguien tenía la
  costumbre mental de "esto resta de tal lote" sin haber vencimientos cargados, el cambio es
  invisible (sin vencimientos, FEFO cae al lote más viejo, que es el único criterio razonable
  disponible). Con vencimientos cargados, el comportamiento es el deseado (consumir lo que vence
  antes), pero es un cambio de comportamiento real frente a la v1.3, donde "-1" simplemente
  restaba de un contador. Se considera una mejora, no una regresión, pero se deja documentado.
- **Riesgo bajo**: lotes "consumidos" (`activo: false`) se acumulan indefinidamente en
  localStorage/Supabase en vez de borrarse. Es intencional (referencia liviana, y porque
  `purchase_history_items` ya cubre el registro fuerte de qué se compró), pero si el uso es muy
  intenso durante años, podría valer la pena un "limpiar lotes consumidos viejos" más adelante —
  no implementado en esta etapa.

## 9. Casos pendientes para futuras iteraciones

- Vencimiento múltiple en un mismo alta de producto (hoy: la cantidad inicial al crear un
  producto nuevo se carga con **una sola** fecha de vencimiento para ambos lotes iniciales — si
  hay vencimientos distintos para lo que está en uso vs. despensa, hay que guardar el producto
  primero y cargar los lotes por separado desde "Lotes").
  Está señalado en la propia UI del formulario.
- No hay aviso/notificación push específico de "se te vence algo" (la notificación local
  existente sigue siendo solo sobre stock bajo). Sería una extensión natural usando la misma
  infraestructura de `notifications.js`.
- El umbral de "próximo a vencer" (30 días) es global y fijo (`DIAS_PROXIMO_A_VENCER` en
  `lotes.js`), no configurable por producto o por usuario.
- No hay forma de "fusionar" dos lotes iguales del mismo producto+ubicación+vencimiento que
  terminen coexistiendo (por ejemplo, comprar el mismo producto dos veces el mismo día con el
  mismo vencimiento crea dos filas en vez de sumarlas). No genera ningún dato incorrecto (el
  total sigue siendo correcto, son dos lotes en vez de uno), solo una posible lista un poco más
  larga de lo estrictamente necesario.
- Productos críticos / índice de tranquilidad / lugares de compra / descuentos y beneficios /
  GPS / mapas: **fuera de alcance a propósito**, ver `BACKLOG.md`.

## 10. Confirmación

- La app sigue funcionando en modo 100% local sin ningún cambio de comportamiento visible más
  allá de lo descripto acá (lotes en vez de contadores).
- Los 13 productos de ejemplo originales conservan exactamente las mismas cantidades totales que
  tenían antes (verificado: la migración reproduce uso/despensa 1:1 como lotes sin
  vencimiento). Se agregaron 2 productos de ejemplo nuevos (Leche, Queso fresco) con
  vencimientos, para poder probar esta evolución sin tener que cargar nada a mano.
- Historial de compras, eventos de stock, presupuesto y predicción siguen funcionando con los
  mismos datos de antes — no se tocó ninguna de esas claves de almacenamiento.
- Verificación realizada: ver la sección de pruebas en la respuesta de entrega (sintaxis,
  bundle de producción, y ejecución en navegador real con Playwright simulando la migración
  v1.3→v1.4 con datos reales).
