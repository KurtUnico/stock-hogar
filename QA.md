# QA — Stock Hogar v1.2 (pase de estabilización pre-deploy)

Revisión funcional, de UX mobile y de código sobre la app tal como quedó tras la
evolución de compra activa / predicciones / presupuesto. **No se agregó ninguna
funcionalidad nueva**: todo lo de abajo son correcciones, validaciones, datos de
demo y ajustes de UI sobre lo que ya existía.

---

## 1. Bugs reales corregidos (con impacto funcional o visual)

### 🔴 Crítico — la barra de "total de compra" quedaba tapada por el header
`.active-purchase-bar` y `.app-header` eran ambos `position: sticky; top: 0`
dentro del mismo contexto de scroll. Al hacer scroll en "Compra activa", la
barra del total (que tiene que estar **siempre visible**, requisito explícito)
quedaba escondida detrás del header. Se corrigió ancla **`top: var(--header-h)`**
en vez de `top: 0`, para que se pegue justo debajo del header.
→ Verificado en navegador real (Playwright): header termina en y=132, la barra
del total ahora arranca en y=153 (sin superposición).
**Archivo:** `src/index.css`

### 🔴 "Borrar todo" no borraba todo
`clearAllData()` dejaba intactas las categorías y el presupuesto/moneda
configurados, contradiciendo lo que decía el botón. Se corrigió para que
también se reseteen (categorías vuelven a las 5 de fábrica, no a una lista
vacía que rompería el selector del formulario).
**Archivos:** `src/utils/storage.js`, `src/App.jsx`

### 🔴 "Restablecer datos de ejemplo" rompía Predicciones/Historial/Presupuesto
Volvía a poner los productos de ejemplo pero dejaba historial de compras,
eventos de stock y presupuesto **vacíos**, en vez de restaurar el demo
completo. Ahora restaura todo de forma consistente.
**Archivo:** `src/utils/storage.js`

### 🟠 Sin confirmación en acciones destructivas
"Borrar todo", "Restablecer datos de ejemplo", "Eliminar producto" y
"Cancelar compra" (con ítems ya marcados como comprados) ejecutaban la acción
con un solo tap, sin posibilidad de arrepentirse. Se agregó `window.confirm()`
con mensajes específicos en los cuatro casos.
→ Verificado en navegador real: el diálogo aparece, y si se cancela, los datos
NO se tocan (probado borrando y confirmando que los 13 productos seguían ahí).
**Archivos:** `src/components/Settings.jsx`, `src/components/ProductForm.jsx`,
`src/components/ActivePurchase.jsx`

### 🟠 Cantidades y precios negativos se podían guardar
`Number(valor) || 0` no bloquea negativos (`-5 || 0` da `-5`, no `0`). Se podía
cargar stock mínimo negativo, restar despensa por debajo de cero vía el campo
de texto, o cargar un precio negativo en compra activa. Se creó un helper
único `numeroPositivo()` y se aplicó en todos los puntos de guardado
(formulario de producto, compra activa, "sumar a despensa" rápido).
**Archivos:** `src/utils/numeros.js` (nuevo), `src/App.jsx`,
`src/components/ProductForm.jsx`

### 🟠 Crash potencial si un producto llega sin nombre
`StockList` hacía `p.nombre.toLowerCase()` al filtrar por búsqueda. Con un
producto corrupto/incompleto (sin `nombre`) esto tira una excepción y rompe
toda la pantalla de Stock. Se blindó con fallback, y de paso `ProductCard`
ahora también tiene defaults razonables si falta `nombre`, `categoria`,
`unidad` o si las cantidades no son números válidos.
**Archivos:** `src/components/StockList.jsx`, `src/components/ProductCard.jsx`,
`src/App.jsx` (`handleAjustar` también blindado contra `NaN`)

### 🟡 Subtotal de compra activa podía quedar inconsistente con el precio
El cálculo de `subtotal = cantidad × precioUnitario` estaba duplicado en el
componente (`ActivePurchase`) y no se recalculaba si el valor llegaba
negativo. Se centralizó en `App.jsx` (`handleActualizarItemActivo`): ahí se
clampea cantidad/precio y se recalcula el subtotal una sola vez, fuente única
de verdad.
**Archivos:** `src/App.jsx`, `src/components/ActivePurchase.jsx`

### 🟡 Datos de ejemplo no cubrían las funciones nuevas
Los 13 productos de ejemplo existían, pero Predicciones, Historial y
Presupuesto arrancaban vacíos en una instalación nueva (no había eventos de
stock ni compras cerradas de ejemplo). Se agregaron eventos y compras demo
(fechas relativas a "ahora", no quedan desactualizados) para que las tres
pantallas muestren algo real desde el primer uso.
**Archivo:** `src/data/sampleData.js` (nuevo contenido), `src/utils/storage.js`

### 🟡 Eventos de stock huérfanos al eliminar un producto
Al borrar un producto, sus eventos de stock (para la predicción) quedaban
para siempre en el storage sin ningún producto al que referenciar. Se
limpian al eliminar. El **historial de compras no se toca** (es un registro
de gasto real, independiente de si el producto sigue existiendo).
**Archivo:** `src/App.jsx`

---

## 2. UX mobile

| Antes | Ahora | Motivo |
|---|---|---|
| Botones +/- de cantidad: 30×30px | 40×40px | Por debajo del mínimo táctil recomendado (~44px); son el control más usado de la app |
| Check de "marcar comprado": 26×26px | 32×32px | Acción primaria y frecuente durante la compra |
| Switch de notificación: 44×26px | 46×28px | Ajuste menor, más cómodo |
| Ícono del header (carrito): 38×38px | 40×40px | Ajuste menor |
| Form de producto: predicción/precio arriba de todo | Movido **después** de los campos editables y los botones Guardar/Eliminar | La tarea principal (editar) no debería requerir scroll para llegar al botón de guardar |
| Dashboard con 0 productos mostraba 4 tarjetas en cero | Estado vacío dedicado con CTA "Agregar tu primer producto" | Mensaje vacío más claro |
| Stock con 0 productos vs. filtro sin resultados mostraban el mismo texto | Dos mensajes distintos | Le dice al usuario qué pasó realmente |
| Inputs de cantidad/precio con `step` implícito 1 | `step="any"` + `inputMode="decimal"` | Permitir decimales (1.5 kg, $99.50) sin fricción, especialmente en teclado numérico mobile |

## 3. Microcopy

- "Restablecer ejemplo" → "Restablecer datos de ejemplo" (más claro).
- Se agregó una línea aclarando que "Restablecer" y "Borrar todo" son
  irreversibles y piden confirmación.
- Mensajes de error nuevos y específicos: "Ingresá una cantidad mayor a 0",
  advertencias de "sin precio" y "con cantidad 0" antes de cerrar una compra.

## 4. Código

- **Duplicación eliminada:** clamping de cantidades/precios unificado en
  `numeroPositivo()` (antes repetido como `Math.max(0, Number(x) || 0)` en
  3-4 lugares distintos con pequeñas variaciones).
- **IDs de eventos:** pasaron de un contador local + `Date.now()` (poco
  robusto entre sesiones) a `crypto.randomUUID()`, igual que el resto de las
  entidades de la app.
- **Moneda:** `formatMoneda` ahora usa 0 decimales para UYU/ARS y 2 para
  USD/EUR (antes redondeaba siempre a entero, perdiendo los centavos en
  dólares).
- **Memoización:** `useMemo` en el cálculo de predicciones del Dashboard
  (antes se recalculaba en cada render sin necesidad).
- **No se tocó** la arquitectura general (`App.jsx` como estado central) ni
  se extrajeron hooks nuevos: es una app chica, y tocar eso ahora antes de un
  deploy agregaba riesgo sin necesidad real.
- **Observación, no corregida:** un par de `setEventos(prev => {... guardar
  en localStorage ...})` hacen el guardado dentro del updater de React. En
  modo desarrollo con StrictMode, React puede invocar ese updater dos veces
  (para detectar efectos secundarios), lo que en el peor caso duplica una
  escritura idéntica a localStorage. No corrompe datos ni es visible para el
  usuario, y no ocurre en build de producción; se deja documentado en vez de
  arriesgar un refactor de la capa de estado justo antes del deploy.

## 5. PWA

- **Íconos:** el manifest y el `apple-touch-icon` usaban solo SVG. **Safari
  de iOS no soporta SVG como `apple-touch-icon`**: al agregar la app a la
  pantalla de inicio desde un iPhone, el ícono podía aparecer en blanco o con
  una captura genérica. Se generaron PNGs reales (192, 512, 512 maskable,
  180 para iOS) a partir del SVG y se referencian en `manifest.json` e
  `index.html`. Verificado visualmente que el ícono rasterizado se ve
  correctamente.
- **Service worker:** se agregaron los nuevos íconos PNG a `CORE_ASSETS`. El
  resto de la estrategia (network-first para navegación, cache-first para el
  resto) ya estaba bien planteada — confirmado con un test real: se cachean
  los recursos en la primera carga, y poniendo el navegador en modo offline
  y recargando, la app sigue funcionando completa (dashboard, stock, todo).
- **Manifest:** validado como JSON correcto; `start_url`, `scope`, colores e
  íconos consistentes con `index.html`.
- **Vercel:** la app es un build estático de Vite sin routing por URL (todo
  es estado de React), así que no necesita `vercel.json` ni reglas de
  rewrite — el preset "Vite" de Vercel alcanza.

---

## 6. Cómo se probó (sin acceso a internet en este entorno)

Este entorno no tiene acceso de red, así que **no pude ejecutar `npm install`
contra el registro real de npm** (lo intenté; falla por la política de red
del sandbox, no por un problema del proyecto). Para no entregar una
confirmación vacía, hice la verificación más rigurosa posible sin red:

1. **Sintaxis e imports:** cada archivo `.js`/`.jsx` del proyecto se
   importó individualmente con esbuild/tsx (el mismo transformador que usa
   Vite por debajo) — sin errores.
2. **Bundle real:** armé el bundle completo de la app con **esbuild**
   (`src/main.jsx` con JSX automático, igual que `@vitejs/plugin-react`),
   sin warnings ni errores de resolución de módulos.
3. **Navegador real (Playwright + Chromium headless):** serví ese bundle por
   HTTP y lo abrí en un navegador de verdad, en viewport mobile (390×844).
   Resultados:
   - La app monta, el Dashboard muestra los 13 productos de ejemplo.
   - Botones +/- de stock funcionan y persisten en `localStorage`.
   - Se pueden abrir el formulario de producto, cambiar entre las 3 vistas
     de Compras, iniciar una compra activa.
   - **0 errores de consola, 0 excepciones de JavaScript** en toda la
     interacción.
   - El service worker se registra y se activa.
   - **Offline real:** con el contexto del navegador puesto en modo
     "offline" y recargando la página, la app sigue cargando completa
     (verificado: dashboard y stock con los 13 productos, sin red).
   - Los diálogos de confirmación (`Eliminar`, `Borrar todo`) aparecen con
     el texto esperado, y cancelarlos efectivamente no borra nada.

Esto cubre lo mismo que validarían `npm run dev` (la app corre en un
navegador) y buena parte de lo que valida `npm run build` (el código
compila/bundlea sin errores con el mismo tipo de herramienta que usa Vite).
Lo único que **no pude confirmar end-to-end** es el comando `vite build`
literal y el deploy en Vercel en sí, porque ambos requieren descargar
paquetes de npm. Te recomiendo correr `npm install && npm run build`
apenas lo bajes — con todo lo de arriba verificado, tengo alta confianza
de que va a compilar limpio.

---

## 7. Archivos modificados en este pase

```
src/App.jsx                          — clamping centralizado, confirmaciones, limpieza de eventos huérfanos
src/index.css                        — fix de sticky bar, tamaños de botones táctiles
src/utils/storage.js                 — clearAllData/resetToSampleData consistentes, seed con demo completo
src/utils/historial.js               — formatMoneda con decimales según moneda
src/utils/stockEvents.js             — IDs con crypto.randomUUID()
src/utils/numeros.js                 — NUEVO: helper numeroPositivo()
src/data/sampleData.js               — eventos/historial/presupuesto de demo (fechas relativas)
src/components/ProductForm.jsx       — validación, confirm al eliminar, reordenado, step=any
src/components/ProductCard.jsx       — fallbacks defensivos ante datos incompletos
src/components/StockList.jsx         — guard ante nombre faltante, empty states diferenciados
src/components/Dashboard.jsx         — empty state real sin productos, useMemo
src/components/ActivePurchase.jsx    — cálculo de subtotal centralizado, confirm al cancelar, warning de cantidad 0
src/components/ShoppingListLista.jsx — step=any en cantidad
src/components/Settings.jsx          — confirmaciones, copy, numeroPositivo
public/manifest.json                 — íconos PNG reales
public/icons/*.png                   — NUEVOS: 192, 512, 512-maskable, apple-touch-icon
index.html                           — apple-touch-icon en PNG (no SVG)
public/service-worker.js             — íconos nuevos en CORE_ASSETS
README.md                            — actualizado
BACKLOG.md                           — sin cambios de alcance (ver evolución anterior)
```

No se modificó: `BottomNav.jsx`, `Modal.jsx`, `StatusBadge.jsx`,
`PredictionCard.jsx`, `PurchaseHistory.jsx`, `BudgetCard.jsx`,
`predictions.js`, `stockLogic.js`, `notifications.js`, `categories.js`,
`vite.config.js`, `package.json` — se revisaron y no tenían problemas.
