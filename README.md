# Stock Hogar

PWA para controlar el stock doméstico de almacén, limpieza, higiene personal, bebé/niño y otros —
saber qué hay en uso, qué hay guardado, comprar mejor (con precios y presupuesto) y predecir cuándo
se va a terminar cada cosa.

> **v1.2:** pase de QA/estabilización para dejarla lista para deploy (sin agregar funcionalidades
> nuevas). Detalle completo de bugs encontrados, correcciones y cómo se probó en
> [`QA.md`](./QA.md).
>
> **v1.3:** cuenta de usuario + sincronización con Supabase, opcional. La app sigue funcionando
> 100% local si no configurás Supabase o no iniciás sesión. Guía completa de configuración,
> modelo de datos y limitaciones conocidas en [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).
>
> **v1.4:** el stock pasó a manejarse por **lotes** (con vencimiento opcional) en vez de dos
> contadores agregados. Migración automática, sin perder datos existentes — ver
> [`LOTES.md`](./LOTES.md) para el detalle completo (modelo de datos, migración, riesgos).
>
> **v1.5:** capa de **inteligencia por vencimiento** sobre los lotes — riesgo de desperdicio,
> orden de consumo recomendado (FEFO), sugerencias de compra y umbral configurable. Detalle
> completo en [`VENCIMIENTOS_INTELIGENCIA.md`](./VENCIMIENTOS_INTELIGENCIA.md).
>
> **v1.6:** **productos críticos** — marcá lo que no puede faltar nunca (pañales, medicamentos,
> leche...) y la app le da prioridad visual en el Dashboard, la lista de compras, predicciones y
> vencimientos. Configurable por el usuario, sin reglas automáticas. Detalle completo en
> [`PRODUCTOS_CRITICOS.md`](./PRODUCTOS_CRITICOS.md).
>
> **v1.7:** **índice de tranquilidad del hogar** — un número de 0 a 100 que resume qué tan
> abastecido está tu hogar hoy, combinando stock, productos críticos, vencimientos y predicción
> de consumo. Sin IA ni fórmulas ocultas: siempre se puede explicar qué bajó (o subió) el
> puntaje. Detalle completo en [`TRANQUILIDAD.md`](./TRANQUILIDAD.md).
>
> **v1.8:** **modo "Voy al súper"** — al tocar el botón, la app arma automáticamente una
> propuesta de compra (urgente / recomendado / próximamente) usando todo lo que ya sabe de tu
> stock, productos críticos, vencimientos, predicción de consumo e historial de precios. Con un
> toque, esa propuesta se convierte en una compra activa lista para editar antes de salir.
> Detalle completo en [`VOY_AL_SUPER.md`](./VOY_AL_SUPER.md).

## Modo "Voy al súper" (v1.8)

Transforma toda la inteligencia que la app ya tenía en una propuesta de compra lista para usar:
tocás "Voy al súper" (desde Inicio o desde Compras) y la app clasifica automáticamente los
productos en **Comprar urgente** (agotados, críticos en riesgo, vencidos con poco stock),
**Comprar recomendado** (por agotarse, próximos a vencer, consumo estimado cercano) y **Comprar
próximamente** (la predicción dice que se vienen, pero hay tiempo) — cada uno con su motivo
explicado en una línea. Calcula el costo estimado de cada sección usando el último precio
conocido (o el promedio histórico si no hay uno más reciente) y muestra el impacto en tu
presupuesto mensual. Un botón "Crear compra activa" convierte la propuesta (urgente +
recomendado) en una compra activa real, con los precios ya prellenados, lista para editar antes
de salir de casa. Configurable en Ajustes (días para "compra próxima", incluir o no predicción/
vencimientos/críticos en la propuesta). Detalle completo en
[`VOY_AL_SUPER.md`](./VOY_AL_SUPER.md).

## Índice de tranquilidad del hogar (v1.7)

Un solo número (0-100) que responde "¿qué tan abastecido está mi hogar hoy?", calculado de forma
100% transparente: empieza en 100 y resta una penalización fija por cada situación encontrada
(stock agotado o por agotarse, vencidos y próximos a vencer, predicción de consumo preocupante),
con los productos críticos pesando más que los normales. Sin inteligencia artificial ni machine
learning. La tarjeta del Dashboard muestra el puntaje, el estado (Excelente/Bien/Atención/
Preocupante/Crítico) y los motivos principales; el detalle muestra todos los factores con su
penalización exacta y los factores positivos. Configurable desde Ajustes (mostrar/ocultar la
tarjeta, incluir o no predicción/vencimientos en el cálculo). Detalle completo en
[`TRANQUILIDAD.md`](./TRANQUILIDAD.md).

## Productos críticos (v1.6)

Cada producto puede marcarse como **crítico** (`esCritico`, boolean, configurable desde el
formulario, sin reglas automáticas ni categorías precargadas). Los productos críticos reciben
prioridad visual en toda la app: tarjeta dedicada en el Dashboard (OK/Por agotarse/Comprar),
distintivo ⭐ en las tarjetas de stock, primer lugar en la lista de compras (críticos en
"Comprar" → críticos "Por agotarse" → normales "Comprar" → normales "Por agotarse"), destacado en
compra activa, y aviso reforzado en predicciones y en vencimientos. No cambia ningún algoritmo
existente (predicción, FEFO, riesgo de desperdicio): es una capa de prioridad visual sobre lo que
ya había. Detalle completo en [`PRODUCTOS_CRITICOS.md`](./PRODUCTOS_CRITICOS.md).

## Inteligencia por vencimiento (v1.5)

Sobre los lotes (v1.4), se agregó una capa de inteligencia para evitar desperdicio: tarjeta de
"Vencimientos" en Inicio (vencidos, próximos a vencer, riesgo de desperdicio en $ o en unidades),
orden de consumo recomendado (FEFO) entre productos, recomendaciones de compra ("no comprar más
X, ya tenés stock por vencer"), una nota informativa no bloqueante durante la compra activa, y un
mensaje que complementa (sin reemplazar) la predicción de consumo cuando hay riesgo real de que
algo venza antes de consumirse. El umbral de "próximo a vencer" es configurable en Ajustes
(30 días por defecto). Detalle completo en
[`VENCIMIENTOS_INTELIGENCIA.md`](./VENCIMIENTOS_INTELIGENCIA.md).

## Lotes y vencimientos (v1.4)

El stock de cada producto ya no es "un número en uso + un número en despensa": ahora son
**lotes** (`StockItem`) — unidades físicas concretas, cada una con su propia cantidad, ubicación
(en uso / despensa) y, si corresponde, vencimiento. El stock total de un producto es la suma de
sus lotes activos.

Lo que incluye:
- Cada producto tiene `requiereVencimiento` (boolean) para sugerir cargar fecha en productos
  perecederos (lácteos, fiambres, medicamentos), sin **obligar** a hacerlo nunca.
- Detalle de producto con sección **Lotes**: ver, agregar, editar, eliminar, mover a en uso y
  consumir lotes individuales, con fecha de vencimiento opcional en cada uno.
- **FEFO** (First Expire First Out): los lotes se ordenan siempre por vencimiento más próximo
  primero, y los botones rápidos +/- de Stock consumen del lote que vence antes.
- Inteligencia de vencimientos: próximo vencimiento por producto, productos vencidos y próximos a
  vencer (< 30 días), visibles en el Dashboard.
- Al cerrar una compra activa, se crean lotes nuevos (no se suma a un contador).
- La predicción de consumo sigue funcionando igual que antes (mismo algoritmo): solo se actualizó
  de dónde lee el stock actual.
- **Migración automática y sin pérdida de datos**: los productos existentes (con sus viejas
  cantidades en uso/despensa) se convierten en lotes sin vencimiento la primera vez que se abre
  la app — tanto en `localStorage` como en Supabase. Detalle completo en
  [`LOTES.md`](./LOTES.md).

## Cuenta y sincronización (v1.3, opcional)

Desde Ajustes → Cuenta, podés crear una cuenta o iniciar sesión para que tus datos se guarden en
Supabase (en vez de únicamente en este dispositivo) y estén disponibles si entrás desde otro
celular o navegador. Si no lo hacés, no cambia nada: la app sigue siendo 100% local, como en
versiones anteriores.

Lo que incluye:
- Registro, inicio de sesión, recuperación de contraseña y cierre de sesión (Supabase Auth).
- Cada cuenta tiene un hogar (`household`) por defecto, creado automáticamente al registrarte.
- Todos los datos (productos, categorías, lista de compras, compra activa, historial, eventos de
  stock, presupuesto) se sincronizan contra Postgres, con una copia local para seguir usando la
  app sin conexión.
- Si había datos cargados en este dispositivo antes de iniciar sesión, se ofrece migrarlos a la
  cuenta (una sola vez).
- Row Level Security: cada quien solo puede leer/escribir datos de los hogares donde es miembro.

**Para activarlo:** ver [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — creación del proyecto, SQL
de tablas (`supabase/schema.sql`) y políticas (`supabase/policies.sql`), variables de entorno
(`.env.example`), y las limitaciones conocidas de esta primera versión de sincronización.

## Qué incluye esta versión (v1.1)

**Base (v1.0):**
- Alta, edición y eliminación de productos, con categorías configurables y unidad de medida.
- Estado automático por producto: **OK** (verde), **Por agotarse** (amarillo) y **Comprar** (rojo).
- Dashboard con totales y accesos rápidos.
- Pantalla de Stock con buscador, filtros por categoría/estado y botones +/− rápidos.
- Lista de compras automática + ítems manuales.
- Todo en `localStorage`, funciona 100% offline, sin backend. Manifest + Service Worker incluidos.

**Nuevo en esta evolución (v1.1):**
- **Compra activa**: modo para usar en el supermercado — agregar precio y cantidad a cada
  producto, marcarlo como agregado al carrito, ver el total acumulado en tiempo real y cómo
  impacta en el presupuesto del mes.
- **Cerrar compra**: guarda la compra en el historial, actualiza el stock de despensa de los
  productos comprados y limpia la compra activa, con un resumen de confirmación antes de cerrar.
- **Historial de compras**: todas las compras cerradas, con fecha, total y detalle de precios.
  Cada producto muestra su último precio pagado y el promedio histórico (badge en la tarjeta de
  Stock y panel ampliado al editar el producto).
- **Predicciones de consumo**: a partir de los movimientos de stock, la app estima cuántos días
  de stock quedan, cuándo se agotaría el producto y con qué confianza (baja/media/alta). Se
  muestran en Inicio y en el detalle de cada producto.
- **Presupuesto mensual**: configurable en Ajustes (monto + moneda). Se ve en Inicio (gastado vs.
  disponible) y durante la compra activa (con aviso si la compra en curso lo supera).

## Estructura del proyecto

```
stock-hogar/
├── index.html
├── package.json
├── vite.config.js
├── .env.example                # Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
├── BACKLOG.md                  # Funcionalidades pedidas pero NO implementadas (documentadas)
├── QA.md                       # Pase de QA/estabilización (v1.2)
├── SUPABASE_SETUP.md           # Cómo configurar Supabase (v1.3)
├── LOTES.md                    # Modelo de lotes/vencimientos: datos, migración, riesgos (v1.4)
├── VENCIMIENTOS_INTELIGENCIA.md # Inteligencia por vencimiento: riesgo, FEFO, recomendaciones (v1.5)
├── PRODUCTOS_CRITICOS.md        # Productos críticos: modelo, migración, prioridad visual (v1.6)
├── TRANQUILIDAD.md               # Índice de tranquilidad: fórmula, factores, casos borde (v1.7)
├── VOY_AL_SUPER.md                # Modo Voy al súper: algoritmo, clasificación, casos borde (v1.8)
├── supabase/
│   ├── schema.sql               # Tablas + índices + trigger de aprovisionamiento
│   ├── policies.sql             # Row Level Security
│   ├── migration_v2_lotes.sql   # Migración incremental: lotes y vencimientos (v1.4)
│   ├── migration_v3_inteligencia.sql # Migración incremental: inteligencia por vencimiento (v1.5)
│   ├── migration_v4_criticos.sql # Migración incremental: productos críticos (v1.6)
│   ├── migration_v5_tranquilidad.sql # Migración incremental: índice de tranquilidad (v1.7)
│   └── migration_v6_voy_al_super.sql # Migración incremental: modo "Voy al súper" (v1.8)
├── public/
│   ├── manifest.json
│   ├── service-worker.js
│   └── icons/
└── src/
    ├── main.jsx
    ├── App.jsx                  # Estado global, persistencia local/nube, navegación
    ├── index.css
    ├── contexts/
    │   └── AuthContext.jsx       # Sesión, hogar, online/offline, signUp/signIn/signOut
    ├── lib/
    │   ├── supabaseClient.js     # Cliente de Supabase (o null si no está configurado)
    │   ├── cloudRepo.js          # CRUD contra Supabase, mapeo camelCase <-> snake_case
    │   ├── cloudCache.js         # Caché local del modo nube (claves separadas del modo local)
    │   └── migration.js          # Migración localStorage -> Supabase
    ├── data/
    │   ├── categories.js
    │   └── sampleData.js
    ├── utils/
    │   ├── storage.js           # Persistencia 100% local + migraciones v2/v3 (lotes)
    │   ├── stockLogic.js        # Estado/total/nivel de stock — derivado de los lotes
    │   ├── lotes.js             # StockItem: crear, FEFO, vencimientos, +/- rápido
    │   ├── stockEvents.js       # Catálogo de eventos de movimiento de stock
    │   ├── predictions.js       # Cálculo de la predicción de consumo
    │   ├── historial.js         # Precio histórico por producto, gasto del mes, formato de moneda
    │   ├── numeros.js           # Helper de saneo de cantidades/precios
    │   └── notifications.js     # Permisos y notificaciones locales
    └── components/
        ├── auth/
        │   ├── AuthPanel.jsx      # Login / registro / recuperar contraseña
        │   └── MigratePrompt.jsx  # Modal "¿migrar tus datos locales?"
        ├── BottomNav.jsx
        ├── Dashboard.jsx         # Resumen + presupuesto + predicciones + vencimientos
        ├── StockList.jsx
        ├── ProductCard.jsx       # Stock derivado de lotes + badge de vencimiento/último precio
        ├── ProductForm.jsx       # Alta con lotes iniciales; detalle con gestor de lotes
        ├── LotesManager.jsx      # Sección "Lotes" del detalle de producto (en uso / despensa)
        ├── ShoppingList.jsx      # Contenedor con 3 sub-vistas (Lista / Compra activa / Historial)
        ├── ShoppingListLista.jsx # Vista "Lista" (la lógica original de compras)
        ├── ActivePurchase.jsx    # Vista "Compra activa"
        ├── PurchaseHistory.jsx   # Vista "Historial"
        ├── PredictionCard.jsx
        ├── BudgetCard.jsx
        ├── Settings.jsx          # Incluye Cuenta/Sesión/Migración/Sincronización
        ├── Modal.jsx
        └── StatusBadge.jsx
```

## Modelo de datos agregado

Todo vive en `localStorage`, cada uno bajo su propia clave (ver `src/utils/storage.js`).
Modelo completo de lotes/vencimientos (StockItem), con migración y riesgos, en
[`LOTES.md`](./LOTES.md). Resumen del resto:

- **Lotes / StockItem** (`stockhogar_stock_items`, array — la fuente de verdad del stock,
  desde v1.4): `{ id, productId, ubicacion: 'en_uso'|'despensa', cantidad, fechaCompra,
  fechaVencimiento, precioUnitario, observaciones, activo, fechaCreacion, fechaActualizacion }`
- **Compra activa** (`stockhogar_active_purchase`, un solo registro o `null`):
  `{ iniciadaEn, items: [{ id, productoId|null, nombre, categoria, cantidad, unidad,
  precioUnitario, subtotal, comprado, origen: 'automatico'|'manual' }] }`
- **Historial de compras** (`stockhogar_purchase_history`, array):
  `{ id, fecha, total, items: [{ productoId, nombre, categoria, cantidad, unidad,
  precioUnitario, subtotal }] }`
- **Eventos de stock** (`stockhogar_stock_events`, array — la materia prima de las predicciones):
  `{ id, productoId, tipo, cantidad, fecha }`, con `tipo` en `creacion | incremento | disminucion |
  compra_cerrada | ajuste_manual | agotado | agregado_lista`
- **Preferencias** (`stockhogar_preferences`): `{ presupuestoMensual, moneda }`

Nada de esto reemplaza los datos existentes: `ensureMigrationV2()` (en `storage.js`) crea estas
claves nuevas solo si no existen, sin tocar productos/categorías/lista que ya tenías cargados.

## Cómo se calcula la predicción

En `src/utils/predictions.js`, función `calcularPrediccion(producto, eventos)`:

1. Se filtran los eventos de ese producto que representan consumo real: `disminucion` (bajaste
   la cantidad en uso o en despensa con los botones +/−) y `ajuste_manual` con cantidad negativa.
2. Si hay al menos 1 de esos eventos, se calcula el **consumo diario promedio** = total consumido
   ÷ días entre el primer y el último evento.
3. **Días restantes** = stock actual (uso + despensa) ÷ consumo diario. Con eso se arma la
   **fecha estimada de agotamiento**.
4. **Confianza**: se cuenta cuántos eventos relevantes hay en total para ese producto
   (`disminucion` + `compra_cerrada` + `ajuste_manual`):
   - 0 eventos → "Sin datos suficientes" (no se muestra predicción)
   - 1-2 → confianza **baja**
   - 3-5 → confianza **media**
   - más de 5 → confianza **alta**

Es un modelo simple (regla de tres sobre el historial reciente), a propósito: cuantos más
movimientos registres usando la app día a día, más precisa se vuelve la estimación.

## Cómo probar la compra activa

1. Andá a la pestaña **Compras** → segmento **Compra activa** (o tocá "🛒 Iniciar compra activa"
   desde la pestaña Lista).
2. Se precarga con los productos que están "Por agotarse"/"Comprar" y con los ítems manuales
   pendientes. Podés agregar algo no previsto con el campo de texto de arriba.
3. Tocá el círculo de cada ítem para marcarlo "en el carrito", cargále cantidad y precio unitario:
   el subtotal y el total fijo de arriba se actualizan al instante.
4. Tocá **Cerrar compra**: te muestra un resumen (cantidad de ítems, total, productos sin precio
   si quedó alguno) antes de confirmar. Al confirmar: se guarda en el historial, se suma el stock
   de despensa de cada producto comprado, y la lista de compras se actualiza sola (los productos
   comprados dejan de aparecer porque ya están por encima del mínimo).
5. También podés **Cancelar compra**: lo que no se compró vuelve a la lista pendiente, no se pierde
   nada.

## Cómo probar el presupuesto mensual

1. Andá a **Ajustes → Presupuesto mensual**, cargá un monto y elegí la moneda, **Guardar**.
2. En **Inicio** vas a ver la tarjeta de presupuesto con gastado / disponible / % consumido (se
   calcula sumando el historial de compras del mes en curso).
3. Cerrá una compra activa con precios cargados: el gasto del dashboard se actualiza solo. Si
   estando en compra activa el total acumulado (sumado a lo ya gastado este mes) supera el
   presupuesto, vas a ver un aviso en la barra fija de total.

## Correrlo en local

Necesitás [Node.js](https://nodejs.org) 18 o superior instalado.

```bash
cd stock-hogar
npm install

# Opcional: solo si vas a usar cuenta/sincronización (ver SUPABASE_SETUP.md).
# Sin este paso, la app funciona igual, en modo 100% local.
cp .env.example .env

npm run dev
```

Abre la app en `http://localhost:5173`. Para probar el comportamiento "instalable" y el service
worker como en producción:

```bash
npm run build
npm run preview
```

## Publicarlo en Vercel

**Opción A — desde la web de Vercel:**
1. Subí esta carpeta a un repositorio en GitHub/GitLab/Bitbucket.
2. Entrá a [vercel.com](https://vercel.com) → "Add New Project" → importá el repo.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Deploy.

**Opción B — desde la terminal:**
```bash
npm i -g vercel
vercel
```

Una vez deployada, podés "Agregar a pantalla de inicio" desde el navegador del celular para
usarla como app instalada.

## Notas sobre las notificaciones push

Esta versión **sigue sin backend**, así que no recibe push reales. `service-worker.js` ya tiene el
listener de `push`/`notificationclick` preparado (comentado) para cuando exista un servidor con
VAPID. Mientras tanto, desde **Ajustes → Notificaciones** se pueden activar avisos locales del
navegador (por ejemplo, al abrir la app si hay productos para comprar y no se avisó hoy todavía).

## Backlog futuro

Login social, sincronización en tiempo real entre dispositivos, hogares compartidos con
invitación, push real con backend, código de barras, comparación de precios entre supermercados,
exportar a Excel, estadísticas avanzadas — **no implementadas a propósito** en esta etapa, están
documentadas en [`BACKLOG.md`](./BACKLOG.md).

## Stack técnico

React 18 + Vite, sin librerías de UI externas (CSS propio). Persistencia 100% local por defecto
(`localStorage`); opcionalmente, cuenta de usuario + Supabase (Auth + Postgres) para sincronizar
entre dispositivos, con copia local para uso offline. Ver [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).
Pensado para que el código sea fácil de leer y extender.
