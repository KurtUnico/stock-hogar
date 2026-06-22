# HANDOFF — Stock Hogar

Documento de traspaso para continuar el proyecto en un chat nuevo sin perder contexto. Generado
porque la conversación anterior llegó al límite de contexto. Todo lo que describe acá ya está
implementado, probado (en la medida de lo posible sin red/Supabase real) y entregado.

---

## 1. Objetivo del proyecto

**Stock Hogar**: PWA (React + Vite) para que una familia controle el stock doméstico —
almacén, limpieza, higiene, bebé/niño, etc. Pensada para uso rápido desde el celular, mobile-first,
con estética "de despensa" (frascos, niveles de llenado). Filosofía de todo el proyecto, repetida
en cada evolución: **funciona 100% offline y sin cuenta por defecto**; todo lo demás (nube, lotes,
inteligencia) es una capa opcional que nunca rompe el modo local.

Quien encarga el trabajo (Charly, developer en Montevideo) pide las evoluciones de a una, con
alcance estrictamente acotado en cada pedido ("no implementar todavía X, Y, Z"), y pide QA/pruebas
explícitas antes de dar por cerrada cada etapa.

---

## 2. Estado actual

- **Versión:** v1.8 ("Stock Hogar · v1.8", visible en Ajustes → Acerca de).
- **Repo:** ~700 KB, código + 10 documentos `.md` de entrega.
- **Build:** verificado limpio (bundle completo con esbuild, sin warnings).
- **No hay nada a medio terminar.** La última evolución entregada (modo "Voy al súper") está
  completa, probada en navegador real y empaquetada. Este es un punto de corte limpio.

---

## 3. Funcionalidades terminadas (por evolución)

### v1.0 — Base
Productos (nombre, categoría, unidad, cantidades, mínimo), categorías configurables, dashboard,
lista de stock con filtros, ajuste rápido +/-, PWA instalable (manifest + service worker),
datos de ejemplo.

### v1.1 — Compra activa / inteligencia básica
Modo "compra activa" (cargar precio y cantidad mientras se está comprando, con total fijo
visible), cierre de compra → historial, historial de compras con precio por producto, predicción
de consumo simple (regla de tres sobre eventos de stock, con nivel de confianza baja/media/alta),
presupuesto mensual configurable.

### v1.2 — QA y estabilización
Pase de QA funcional completo (sin features nuevas): fixes de bugs reales (ver `QA.md`), mejoras
de UX mobile (tamaños de botones, estados vacíos), confirmaciones en acciones destructivas,
generación de íconos PNG reales para PWA (el SVG-only rompía `apple-touch-icon` en iOS).

### v1.3 — Cuenta y Supabase (opcional)
Auth (registro/login/recuperar contraseña/logout) vía Supabase Auth. Cada usuario tiene un
**hogar** (household) creado automáticamente al registrarse (trigger SQL). Todos los datos
sincronizan contra Postgres con Row Level Security, manteniendo una **copia local de caché** para
uso offline. Migración de datos locales a la nube (una sola vez, con detección automática de "hay
algo real para migrar" vs. solo datos de demo). **Todo esto es opcional**: sin sesión, la app se
comporta exactamente igual que en v1.2. Detalle completo: `SUPABASE_SETUP.md`.

### v1.4 — Lotes y vencimientos
El stock dejó de ser dos contadores (`cantidadUso`/`cantidadDespensa`) y pasó a derivarse de una
entidad nueva, **`StockItem` (lote)**: unidad física con cantidad, ubicación (en_uso/despensa),
vencimiento opcional, precio opcional. Estrategia **FEFO** (First Expire First Out) para consumo y
ordenamiento. Gestor de lotes en el detalle de producto (agregar/editar/eliminar/mover/consumir).
**Migración automática verificada sin pérdida de datos** (local y Supabase). Detalle completo:
`LOTES.md`.

### v1.5 — Inteligencia por vencimiento
Capa de inteligencia construida sobre los lotes: tarjeta de "riesgo de desperdicio" en el
Dashboard (vencidos, próximos a vencer, valor económico si hay precios cargados), orden de
consumo recomendado entre productos (FEFO), recomendaciones de compra ("no comprar más X, ya
tenés stock por vencer"), nota informativa no bloqueante en compra activa, complemento (no
reemplazo) de la predicción de consumo con la señal de vencimiento, umbral configurable en
Ajustes (30 días por defecto). Detalle completo: `VENCIMIENTOS_INTELIGENCIA.md`.

### v1.6 — Productos críticos
Campo nuevo `Producto.esCritico` (boolean, default `false`, configurable por el usuario desde el
formulario, sin reglas automáticas ni categorías precargadas). Prioridad visual en toda la app:
tarjeta dedicada "⭐ Productos críticos" en el Dashboard (OK/Por agotarse/Comprar), distintivo ⭐
en tarjetas de stock, reordenamiento de la lista de compras (críticos primero, dentro de cada
nivel de urgencia), destacado en compra activa, aviso reforzado en predicciones y en el detalle
de vencimientos. No se tocó ningún algoritmo existente (predicción, FEFO, riesgo de desperdicio):
es una capa de prioridad visual sobre lo que ya había. Migración local + SQL incremental, sin
pérdida de datos. Detalle completo: `PRODUCTOS_CRITICOS.md`.

### v1.7 — Índice de tranquilidad del hogar
Utilidad nueva `calcularTranquilidad()` que resume en un número 0-100 qué tan abastecido está el
hogar, agregando todo lo que ya existía (estado de stock, productos críticos, vencimientos,
predicción de consumo) sin tocar ninguno de esos cálculos. Fórmula aditiva y 100% transparente
(empieza en 100, resta una penalización fija por cada situación, críticos pesan más que
normales), sin IA/ML. Tarjeta principal nueva en el Dashboard + modal de detalle con factores
positivos/negativos y la penalización exacta de cada uno. 3 preferencias nuevas configurables en
Ajustes (mostrar/ocultar tarjeta, incluir o no predicción/vencimientos). Detalle completo:
`TRANQUILIDAD.md`.

### v1.8 — Modo "Voy al súper"
Utilidad nueva `generarPropuestaCompra()` que transforma toda la inteligencia existente (stock,
críticos, vencimientos, predicción, historial de precios, presupuesto) en una propuesta de compra
clasificada en urgente/recomendado/próximo, cada producto con su motivo explicado y costo
estimado. Tarjeta nueva en el Dashboard ("🛒 Próxima compra") + pestaña nueva en Compras ("Súper")
con la vista completa de la propuesta, resumen de costos por sección, impacto en presupuesto, y
un botón "Crear compra activa" que convierte la propuesta en una compra activa real con precios
prellenados — sin tocar `handleIniciarCompraActiva` (se agregó un handler nuevo al lado). 4
preferencias nuevas en Ajustes (días para "compra próxima", incluir o no predicción/vencimientos/
críticos en la propuesta). Detalle completo: `VOY_AL_SUPER.md`.

---

## 4. Funcionalidades en curso

**Ninguna.** No hay trabajo a medias. El próximo chat arranca de cero en cuanto a tareas (ver
sección 9 para qué se recomienda hacer).

---

## 5. Decisiones técnicas tomadas y por qué

Estas decisiones son **transversales** y se repitieron/respetaron en cada evolución — importante
que quien continúe las conozca antes de tocar código:

1. **Local-first, nube opt-in.** `src/utils/storage.js` (claves `stockhogar_*`) es el modo 100%
   local, nunca se toca su comportamiento. El modo nube usa claves DISTINTAS para su caché
   (`stockhogar_cache_*`, ver `src/lib/cloudCache.js`) para no pisar datos de quien no usa cuenta.
   `App.jsx` decide qué fuente usar según `modoNube` (de `AuthContext`).

2. **Persistencia "optimista + best-effort".** Cada mutación actualiza el estado de React
   inmediatamente (UI nunca espera a la red) y dispara la sincronización contra Supabase en
   segundo plano (`sincronizarNube()` en `App.jsx`), sin bloquear nada. Si falla, se marca
   `syncStatus: 'error'`/`'offline'` y se reintenta al reconectar.

3. **Estrategia de sync deliberadamente simple.** Entidades "completas" (productos, lotes,
   categorías, lista manual, compra activa, preferencias) se reescriben enteras en cada cambio
   (`upsert`/reemplazo). Entidades de **solo-inserción** (historial de compras, eventos de stock)
   solo empujan lo nuevo, nunca reescriben lo viejo. Sin Realtime, sin resolución de conflictos
   real — documentado como limitación consciente en `SUPABASE_SETUP.md`, no un descuido.

4. **Hogares (households) desde el día 1 de Supabase**, aunque hoy es 1 usuario = 1 hogar. La
   tabla `household_members` ya soporta varios miembros; falta UI de invitación (backlog).

5. **RLS como única barrera de seguridad real.** Regla uniforme en las 11 tablas:
   `household_id in (mis household_members)`. Nunca se confía en el cliente para filtrar datos.

6. **El stock siempre se calcula, nunca se guarda como número agregado.**
   `getStockProducto(producto, stockItems)` en `src/utils/stockLogic.js` es la ÚNICA fuente de
   verdad del stock de un producto (suma de lotes activos). Ningún componente debe volver a leer
   `cantidadUso`/`cantidadDespensa` (esos campos ya no existen en productos nuevos/migrados).

7. **FEFO como criterio único de orden/consumo**, centralizado en `src/utils/lotes.js`
   (`ordenarFEFO`). Tanto los botones rápidos +/- como toda la inteligencia de vencimiento lo
   reusan — nunca se reimplementa el criterio de orden en un componente.

8. **Migraciones de datos siempre no-destructivas e idempotentes.** Cada evolución que cambió el
   modelo agregó una función `ensureMigrationVN()` (local, en `storage.js`) y un archivo SQL
   incremental separado (`supabase/migration_vN_*.sql`) que NUNCA borra columnas/datos viejos,
   solo agrega lo nuevo, y es seguro de correr más de una vez. `schema.sql` es solo para
   instalaciones 100% nuevas.

9. **No se duplica lógica de negocio en componentes.** Toda regla de cálculo vive en
   `src/utils/*.js` (puro, sin JSX, fácil de testear con Node plano). Los componentes solo llaman
   y muestran.

10. **Cada evolución respeta estrictamente el alcance pedido.** Cuando el pedido dice "no
    implementar todavía X", se documenta en `BACKLOG.md` con una nota técnica de cómo se
    implementaría más adelante, pero no se toca el código. Esto es un patrón explícito y repetido
    en todos los pedidos del usuario — **mantenerlo** en lo que sigue.

11. **No reescribir algoritmos existentes al integrarlos con algo nuevo.** Tanto en v1.4 como en
    v1.5 se pidió explícitamente "no reescribir la predicción, solo adaptar/complementar" — se
    resolvió SIEMPRE agregando una función nueva que envuelve/complementa, nunca modificando el
    algoritmo original (`calcularPrediccion` en `src/utils/predictions.js` no cambió su lógica
    interna desde v1.1, solo el origen del dato "stock actual"). En v1.6 (productos críticos) se
    repitió el mismo patrón: `predictions.js` y `wasteIntelligence.js` no se tocaron, la
    "prioridad visual" se resolvió con una prop opcional (`critico`) en los componentes de
    presentación, nunca cambiando qué calculan las utilidades. En v1.7 (tranquilidad) se llevó
    el patrón un paso más allá: una utilidad de **agregación** nueva (`calcularTranquilidad`)
    consume `getStatus`, `productosVencidos`/`productosProximosAVencer` y `calcularPrediccion`
    tal cual están, sin tocar ninguna — demuestra que el patrón escala incluso para una
    funcionalidad que combina varias fuentes a la vez.

---

## 6. Modelo de datos (resumen — el detalle completo está en cada `.md`)

- **`productos`**: catálogo (nombre, categoría, unidad, stockMinimo, notificacionActiva,
  requiereVencimiento). NO tiene cantidades — eso vive en lotes.
- **`stockItems` (lotes)**: `{ id, productId, ubicacion: 'en_uso'|'despensa', cantidad,
  fechaCompra, fechaVencimiento, precioUnitario, observaciones, activo, fechaCreacion,
  fechaActualizacion }`.
- **`categorias`**: array de strings por hogar.
- **`manualItems`**: ítems sueltos de la lista de compras (sin vínculo a producto).
- **`compraActiva`**: a lo sumo una por hogar, con `items[]` (snapshot de cada producto +
  cantidad/precio/vencimiento cargados durante la compra).
- **`historialCompras`**: compras cerradas, solo-inserción.
- **`eventos`** (stock_events): log de movimientos (`creacion|incremento|disminucion|
  compra_cerrada|ajuste_manual|agotado|agregado_lista`), alimenta la predicción.
- **`preferencias`**: `{ presupuestoMensual, moneda, diasProximoVencimiento }`.

En Supabase, todo lo anterior tiene su tabla equivalente (snake_case) bajo `household_id`, ver
`supabase/schema.sql` (instalación nueva) + los 2 archivos `migration_vN_*.sql` (instalación
existente, incrementales y no destructivos).

---

## 7. Estructura de archivos (la que importa para seguir trabajando)

```
src/
  App.jsx                  # Estado global + persistencia local/nube + todos los handlers
  contexts/AuthContext.jsx # Sesión, hogar, online/offline
  lib/
    supabaseClient.js      # Cliente (o null si no hay env vars)
    cloudRepo.js           # CRUD Supabase, mapeo camelCase<->snake_case
    cloudCache.js          # Caché local del modo nube (claves separadas del modo local)
    migration.js           # Migración local -> Supabase
  utils/                   # TODA la lógica de negocio, sin JSX
    storage.js              # Persistencia local + ensureSeed/ensureMigrationV2/V3
    stockLogic.js            # getStockProducto/getStatus/getTotal — fuente de verdad del stock
    lotes.js                  # StockItem: crear, FEFO, vencido/próximo, +/- rápido
    wasteIntelligence.js       # Inteligencia por vencimiento (capa más alta, usa lotes+stockLogic)
    predictions.js              # Predicción de consumo (algoritmo intacto desde v1.1)
    stockEvents.js                # Catálogo de tipos de evento
    historial.js                   # Precio histórico, gasto del mes, formatMoneda
    numeros.js                      # numeroPositivo() — saneo central de cantidades/precios
    notifications.js                 # Notificaciones locales (push real: backlog)
  components/              # Presentacionales, consumen utils/, no reimplementan lógica
    auth/AuthPanel.jsx, auth/MigratePrompt.jsx
    Dashboard.jsx, StockList.jsx, ProductCard.jsx, ProductForm.jsx, LotesManager.jsx,
    VencimientosCard.jsx, VencimientosDetalle.jsx, ShoppingList.jsx, ShoppingListLista.jsx,
    ActivePurchase.jsx, PurchaseHistory.jsx, PredictionCard.jsx, BudgetCard.jsx,
    TranquilidadCard.jsx, TranquilidadDetalle.jsx, VoyAlSuper.jsx, VoyAlSuperCard.jsx,
    Settings.jsx, Modal.jsx, StatusBadge.jsx, BottomNav.jsx
supabase/
  schema.sql                 # Instalación NUEVA (incluye todo hasta v1.8)
  policies.sql                # RLS, instalación nueva
  migration_v2_lotes.sql        # Incremental: agrega stock_items a un proyecto ya existente
  migration_v3_inteligencia.sql  # Incremental: agrega settings.dias_proximo_vencimiento
  migration_v4_criticos.sql      # Incremental: agrega products.es_critico
  migration_v5_tranquilidad.sql  # Incremental: agrega 3 columnas de config en settings
  migration_v6_voy_al_super.sql  # Incremental: agrega 4 columnas de config en settings
*.md (raíz)
  README.md                  # Overview + cómo correr/deployar
  QA.md                       # Pase de QA de v1.2 (bugs encontrados y corregidos)
  SUPABASE_SETUP.md            # Cómo configurar Supabase, modelo de datos, limitaciones de sync
  LOTES.md                      # Entrega v1.4: modelo, migración, riesgos
  VENCIMIENTOS_INTELIGENCIA.md   # Entrega v1.5: utilidades, cálculos, casos borde
  PRODUCTOS_CRITICOS.md          # Entrega v1.6: modelo, migración, prioridad visual, casos borde
  TRANQUILIDAD.md                # Entrega v1.7: fórmula, factores, casos borde
  VOY_AL_SUPER.md                # Entrega v1.8: algoritmo, clasificación, casos borde
  BACKLOG.md                      # TODO lo NO implementado, con notas técnicas para cuando se haga
```

---

## 8. Riesgos conocidos

1. **Nunca se probó contra un proyecto Supabase real.** El entorno de desarrollo de Claude no
   tiene acceso a red, así que toda la integración con Supabase se verificó con: (a) análisis
   estático/sintáctico, (b) un cliente Supabase **simulado** (stub) que imita la forma de la API
   real pero no su comportamiento, corrido en un navegador real vía Playwright. Es una
   verificación sólida de que el CÓDIGO está bien escrito, pero **no reemplaza correr
   `schema.sql`/`policies.sql`/las migraciones contra un proyecto real** antes de ir a producción.
2. **Orden de los scripts SQL importa.** Para proyectos Supabase ya existentes, hay que correr
   `migration_v2_lotes.sql` y `migration_v3_inteligencia.sql` en ese orden (después de los
   originales `schema.sql`/`policies.sql`). Está documentado en `SUPABASE_SETUP.md`, pero depende
   de que el desarrollador lo siga — no hay manera de forzarlo desde la app.
3. **Sync simple, no realtime.** Si dos dispositivos editan offline al mismo tiempo, el que
   reconecta último puede pisar cambios del otro en las entidades que se reescriben completas.
   Aceptado conscientemente para esta escala (familia, no equipo grande). Documentado en
   `SUPABASE_SETUP.md` y `BACKLOG.md`.
4. **No hay suite de tests automatizada en el repo.** Toda la verificación de cada evolución se
   hizo con scripts ad-hoc (sintaxis vía esbuild/tsx, bundle de producción, pruebas en Chromium
   vía Playwright) armados y descartados en cada sesión — no quedaron commiteados como tests
   repetibles. Si se quiere verificar de nuevo, hay que rearmar ese harness (ver sección 11).
5. **Particularidad operativa de esta sesión:** en algún punto, llamadas a la herramienta de
   edición de archivos reportaron error pero en realidad SÍ se habían aplicado (se detectó
   auditando archivos con `find -newer` y revisando contenido real). Si el próximo Claude ve un
   error de herramienta inesperado, conviene **verificar el estado real del archivo antes de
   reintentar o asumir que falló** — no es necesariamente confiable el mensaje de error solo.
6. **Detalle menor de StrictMode (no bloqueante):** un par de `setEventos(prev => {...guardar...})`
   en `App.jsx` hacen el guardado dentro del updater de React, lo que en desarrollo con
   StrictMode podría duplicar una escritura idéntica a localStorage (idempotente, sin corrupción
   de datos, no ocurre en producción). Documentado en `QA.md`, decidido NO arreglar para no
   arriesgar un refactor de la capa de estado sin necesidad real.

---

## 9. Próximo paso recomendado

Todo el lote de "bajo esfuerzo, alto valor" del backlog original (productos críticos v1.6,
tranquilidad v1.7, Voy al súper v1.8) ya está implementado. Lo que queda son evoluciones de
esfuerzo medio/alto, o un pase de QA:

**Opción A — Lugares de compra (esfuerzo medio, habilita varias cosas más).**
Tabla nueva `stores` (household_id, nombre, ubicación opcional), referenciada desde
`purchase_history`. Con "Voy al súper" ya implementado, encajaría como filtro adicional sobre
`generarPropuestaCompra()` sin tocarla. Habilita después comparación de precios entre
supermercados (explícitamente pedido NO implementar hasta ahora, en cada evolución).

**Opción B — Pase de QA/estabilización antes de seguir sumando.**
Desde el último QA dedicado (v1.2) se agregaron seis evoluciones (Supabase, lotes, inteligencia,
productos críticos, tranquilidad, Voy al súper) sin un pase de QA específico tipo el de `QA.md`.
Cada una se probó al cerrarla (incluida v1.8, ver `VOY_AL_SUPER.md` sección 9), pero nunca todas
juntas con foco adversarial (datos corruptos, casos límite cruzados entre lotes+nube+
inteligencia+críticos+tranquilidad+voy_al_super, etc.). Podría valer la pena un QA acumulado —
mismo enfoque que `QA.md`, cubriendo v1.3 a v1.8.

**Opción C — Exportar historial a Excel / estadísticas avanzadas.**
Funcionalidades chicas y autocontenidas, no dependen de nada nuevo.

No hay una respuesta "correcta" — depende de si el usuario prioriza velocidad de funcionalidades
o solidez antes de seguir. Si no dice nada, preguntar.

---

## 10. Tareas pendientes priorizadas (de `BACKLOG.md`, con criterio de esfuerzo/impacto)

**Esfuerzo medio:**
1. Lugares de compra / tiendas (tabla nueva `stores`, opcional, referenciada desde
   `purchase_history`; habilita comparación de precios y un filtro futuro en Voy al súper).
2. Comparación de precios entre supermercados (depende de #1).
3. Exportar historial a Excel.
4. Estadísticas avanzadas (gráficos de gasto).
5. Tendencia del índice de tranquilidad ("Subió 4% desde la semana pasada") — requiere una tabla
   de histórico nueva, ver nota técnica en `BACKLOG.md`.

**Esfuerzo alto / infraestructura:**
6. Supabase Realtime (sync en vivo entre dispositivos).
7. Hogares compartidos con invitación real (UI + policy de insert acotada).
8. Push notifications reales con backend + VAPID.
9. Login social.
10. Resolución de conflictos real para edición concurrente offline.
11. Escaneo de código de barras.
12. GPS / geolocalización / mapas / descuentos y beneficios (explícitamente fuera de alcance en
    cada pedido hasta ahora).

---

## 11. Cómo se verificó cada evolución (para repetir si hace falta)

Sin acceso a red en este entorno, no se puede correr `npm install` real ni Supabase real. El
método usado, repetible:

1. **Sintaxis/imports:** symlink de `react`/`react-dom` (ya instalados globalmente en
   `/home/claude/.npm-global/lib/node_modules`) a `node_modules/`, más un stub mínimo de
   `@supabase/supabase-js` en `node_modules/@supabase/supabase-js/` (objeto con `auth.*` y
   `from()` que devuelven promesas con la forma correcta). Después, `tsx --no-warnings -e
   "import('./archivo.jsx')"` por cada archivo.
2. **Bundle real:** `esbuild` (vendorizado dentro de `tsx`, en
   `~/.npm-global/lib/node_modules/tsx/node_modules/esbuild/bin/esbuild`) con
   `--bundle --jsx=automatic --define:import.meta.env.VITE_SUPABASE_URL=...` (esto resuelve las
   env vars de Vite, que Node no entiende nativamente).
3. **Navegador real:** Playwright con Chromium ya instalado en `/opt/pw-browsers` (hay que pasar
   `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Se sirve el bundle con un server HTTP mínimo de
   Node y se interactúa con la UI real (clicks, fills, asserts sobre `localStorage` y el DOM).
4. **Limpieza:** borrar `node_modules` y los archivos de test temporales antes de empaquetar el
   zip final (no deben quedar en la entrega).

---

# PROMPT DE CONTINUIDAD

```
Estoy continuando el desarrollo de "Stock Hogar", una PWA (React + Vite) de control de stock
doméstico para una familia en Montevideo, Uruguay. Te adjunto el .zip del proyecto completo tal
como quedó al cierre de la versión v1.7.

CONTEXTO DEL PROYECTO:
- App mobile-first, local-first (funciona 100% offline y sin cuenta por defecto).
- Versiones ya implementadas y entregadas:
  v1.0: stock básico, categorías, dashboard.
  v1.1: compra activa, historial de compras, predicción de consumo, presupuesto mensual.
  v1.2: pase de QA/estabilización (ver QA.md).
  v1.3: cuenta de usuario + sincronización con Supabase, OPCIONAL (auth, hogares con RLS,
        migración local->nube, caché offline). Ver SUPABASE_SETUP.md.
  v1.4: modelo de stock por LOTES (StockItem) con vencimiento opcional y FEFO, reemplazando los
        viejos contadores cantidadUso/cantidadDespensa. Migración automática sin pérdida de
        datos. Ver LOTES.md.
  v1.5: capa de inteligencia por vencimiento (riesgo de desperdicio, orden de consumo
        recomendado, recomendaciones de compra, complemento de la predicción). Ver
        VENCIMIENTOS_INTELIGENCIA.md.
  v1.6: productos críticos (Producto.esCritico boolean, configurable, sin reglas automáticas).
        Prioridad visual en Dashboard, lista de compras (reordenada), compra activa,
        predicciones y vencimientos. No tocó ningún algoritmo existente. Ver
        PRODUCTOS_CRITICOS.md.
  v1.7: índice de tranquilidad del hogar (calcularTranquilidad(), 0-100, sin IA/ML, agregación
        100% transparente sobre stock + críticos + vencimientos + predicción). Tarjeta principal
        en Dashboard + modal de detalle + 3 toggles en Ajustes. No tocó ningún algoritmo
        existente. Ver TRANQUILIDAD.md.
  v1.8: modo "Voy al súper" (generarPropuestaCompra(): clasifica productos en urgente/
        recomendado/próximo con motivo y costo estimado, usando stock + críticos +
        vencimientos + predicción + historial de precios). Tarjeta en Dashboard + pestaña nueva
        en Compras + botón "Crear compra activa" (handler NUEVO, no tocó
        handleIniciarCompraActiva). 4 preferencias nuevas en Ajustes. Ver VOY_AL_SUPER.md.
- No hay ninguna funcionalidad a medio terminar: es un punto de corte limpio.

DECISIONES TÉCNICAS QUE TENÉS QUE RESPETAR (no las reinventes ni las rompas):
1. El modo 100% local (sin cuenta) NUNCA debe cambiar de comportamiento al tocar el modo nube.
2. El stock de un producto SIEMPRE se calcula desde los lotes (utils/stockLogic.js,
   getStockProducto). Nunca leas/escribas cantidadUso/cantidadDespensa: ya no existen.
3. FEFO (utils/lotes.js, ordenarFEFO) es el único criterio de orden/consumo. No lo reimplementes
   en un componente.
4. Toda lógica de negocio va en src/utils/*.js (puro, sin JSX). Los componentes solo consumen.
5. Si agregás un modelo de dato nuevo: migración local no-destructiva (ensureMigrationVN en
   storage.js) + archivo SQL incremental separado en supabase/ que nunca borra columnas/datos
   existentes + actualizar schema.sql para instalaciones nuevas. EXCEPCIÓN: si solo agregás
   preferencias booleanas/simples con default razonable, alcanza con sumarlas a
   DEFAULT_PREFERENCES — loadPreferences() ya hace merge defensivo (ver v1.5, v1.7, v1.8), no
   hace falta una ensureMigrationVN dedicada para eso. Pero si la preferencia necesita persistir
   en Supabase, igual hace falta el alter table + el mapeo en cloudRepo.js.
6. Sincronización con Supabase: optimista (UI no espera la red), best-effort, sin Realtime
   (decisión consciente, documentada). No la "arregles" sin que te lo pidan explícitamente.
7. Cuando un pedido diga "no implementar todavía X": documentalo en BACKLOG.md con una nota
   técnica de cómo se haría, pero NO toques código de eso. Este patrón se respetó en TODAS las
   evoluciones anteriores.
8. No reescribas algoritmos existentes al integrarlos con algo nuevo (ej: la predicción de
   consumo en utils/predictions.js no cambió su lógica interna desde v1.1; todo lo nuevo la
   complementa desde afuera). En v1.6 esto se resolvió con props opcionales (ej. `critico` en
   PredictionCard); en v1.7 y v1.8, con utilidades de agregación nuevas que CONSUMEN las
   utilidades existentes sin tocarlas.
9. Cuando agregues un boolean/campo de configuración del usuario (ej. esCritico en v1.6), el
   resto de la app debe consumirlo SIEMPRE a través de una función en utils/ (ej.
   esProductoCritico()), nunca leyendo producto.campo directo — así una futura evolución a una
   escala/enum solo requiere cambiar esa función.
10. Si una frase a pluralizar es compuesta (ej. "producto por agotarse"), NUNCA concatenes una
    "s" al final mecánicamente — define singular y plural explícitos por separado. Bug real
    encontrado y corregido en v1.7 ("producto por agotarses").
11. Si un handler existente NO debe modificarse (pedido explícito), creá uno nuevo al lado que
    reutilice el mismo patrón de construcción de datos, en vez de parametrizar/condicionar el
    original. Así se resolvió "Crear compra activa desde la propuesta" en v1.8
    (handleIniciarCompraActivaDesdePropuesta, separado de handleIniciarCompraActiva).
12. Cuidado con leer un prop de estado (ej. compraActiva) inmediatamente después de la función
    que lo actualiza, dentro del mismo handler/closure — React no lo actualiza sincrónicamente,
    vas a leer el valor del render anterior. Si necesitás reaccionar al resultado de una acción
    async/de estado, usá un callback explícito de éxito en vez de releer el prop. Bug real
    encontrado y corregido en v1.8 (navegación post-creación de compra activa).

ENTORNO DE DESARROLLO:
- Sin acceso a red: no se puede npm install contra el registro real ni probar contra un proyecto
  Supabase real.
- Verificación usada en su lugar (repetible, ver sección 11 del handoff completo si lo subís
  también): symlink de react/react-dom ya instalados globalmente + stub de @supabase/supabase-js
  para resolver imports, esbuild para bundlear (con --define para las env vars de Vite), y
  Playwright con Chromium (ya instalado en /opt/pw-browsers) para probar en navegador real.
- IMPORTANTE (aprendido en v1.6, reconfirmado en v1.7 y v1.8): cada llamada a la herramienta de
  bash es un proceso/contenedor EFÍMERO e independiente — un servidor HTTP arrancado en
  background en una llamada NO sigue vivo en la siguiente llamada. Para probar con Playwright,
  arrancá el server (en background, con `&` dentro de un subshell `(...)` para que el `cd` no se
  pierda) Y corré el script de Playwright DENTRO DE LA MISMA invocación de la herramienta de bash.
- Antes de asumir que una edición de archivo falló por un error de la herramienta, verificá el
  estado real del archivo: hubo casos en sesiones anteriores donde el error era espurio y el
  cambio sí se había aplicado.
- Escribí pruebas unitarias en Node plano (tsx, sin framework) ANTES de integrar en componentes
  — en v1.7 esto detectó el bug de pluralización, y en v1.8 validó el algoritmo de clasificación
  completo (19 casos) antes de tocar JSX, mucho más rápido que encontrar problemas en el
  navegador.
- Si agregás una pestaña/segmento nuevo a un componente con `.segmented` (ej. ShoppingList), las
  etiquetas largas pueden desbordar en mobile (390px) — usá etiquetas cortas y considerá ajustar
  `.segmented__item` (font-size, overflow) si pasás de 3 a 4+ pestañas, como se hizo en v1.8.

QUÉ NECESITO QUE HAGAS AHORA:
[Charly: completá esto con el pedido específico. Si no sabés por dónde seguir, las opciones que
veníamos evaluando eran: (A) Lugares de compra — tabla `stores`, esfuerzo medio, habilita
comparación de precios entre supermercados y un filtro futuro en Voy al súper; o (B) un pase de
QA acumulado cubriendo v1.3 a v1.8 antes de seguir sumando funcionalidades, ya que no se hizo un
QA dedicado desde v1.2. Decime cuál preferís, o algo distinto si cambiaron las prioridades.]

Para arrancar: descomprimí el zip adjunto, revisá BACKLOG.md (qué falta) y los .md de cada
versión para el detalle técnico, y confirmame que tenés el contexto antes de escribir código.
```
