# Configurar Supabase para Stock Hogar

Stock Hogar funciona sin cuenta (100% local) por defecto. Esta guía es para
activar la parte opcional: cuenta de usuario + sincronización en la nube.
Si no la seguís, la app sigue andando exactamente igual que siempre.

## 1. Crear el proyecto

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (o
   usá uno existente).
2. Anotá, de **Project Settings → API**:
   - **Project URL** → va en `VITE_SUPABASE_URL`
   - **anon public key** → va en `VITE_SUPABASE_ANON_KEY` (NO uses la
     `service_role`, esa nunca debe llegar al cliente)

## 2. Crear las tablas

En el **SQL Editor** de Supabase, corré en este orden:

1. `supabase/schema.sql` — crea todas las tablas, índices, y el trigger que
   le arma un hogar por defecto a cada usuario nuevo.
2. `supabase/policies.sql` — activa Row Level Security y las políticas (un
   usuario solo puede leer/escribir hogares donde es miembro).
3. **Solo si tu proyecto YA EXISTÍA antes de la evolución de lotes/vencimientos**
   (ya corriste los dos de arriba antes y tenés datos reales): corré también
   `supabase/migration_v2_lotes.sql`. Agrega la tabla `stock_items` y migra
   el stock existente a lotes, sin tocar ni borrar nada de lo que ya tenías.
   Si tu proyecto es nuevo, no hace falta — `schema.sql` ya incluye todo.
   Detalle completo en `LOTES.md`.
4. **Solo si tu proyecto YA EXISTÍA antes de la evolución de inteligencia por
   vencimiento**: corré también `supabase/migration_v3_inteligencia.sql`.
   Agrega una sola columna (`settings.dias_proximo_vencimiento`, el umbral
   configurable de "próximo a vencer"). Si tu proyecto es nuevo, no hace
   falta. Detalle en `VENCIMIENTOS_INTELIGENCIA.md`.

Podés pegar el contenido de cada archivo tal cual en el editor y ejecutar.

## 3. Configurar autenticación

En **Authentication → Providers**, "Email" ya viene activado por defecto,
no hace falta tocar nada para que `signUp`/`signInWithPassword` funcionen.

Dos cosas a decidir según tu caso:

- **Confirmación de email**: en **Authentication → Settings**, "Confirm
  email" viene activada por defecto (el usuario tiene que click-confirmar
  antes de poder iniciar sesión). Para probar más rápido en desarrollo,
  podés desactivarla temporalmente; para producción, se recomienda
  dejarla activa.
- **Recuperar contraseña**: en **Authentication → URL Configuration**,
  agregá la URL de tu app (la de Vercel, y `http://localhost:5173` para
  desarrollo) a "Redirect URLs", para que el link del email de
  recuperación vuelva a la app correctamente.

## 4. Variables de entorno

```bash
cp .env.example .env
```

Completá `.env` con tu URL y anon key. Para Vercel, configurá las mismas dos
variables en **Project Settings → Environment Variables** (con el prefijo
`VITE_`, igual que en local — Vite las necesita así para exponerlas al
cliente en build time).

## 5. Correr local

```bash
npm install
npm run dev
```

Andá a Ajustes → Cuenta. Si configuraste las variables, vas a ver el
formulario de "Iniciar sesión / Crear cuenta". Si no las configuraste, vas
a ver un aviso de que la nube no está configurada — la app sigue 100%
funcional en modo local.

## 6. Deploy en Vercel

Igual que siempre (ver README.md): framework Vite, build `npm run build`,
output `dist`. Antes de la primera build, agregá las dos variables de
entorno en el proyecto de Vercel (Project Settings → Environment Variables),
para los entornos que correspondan (Production / Preview / Development).

---

## Qué pasa exactamente al iniciar sesión por primera vez

1. Supabase Auth crea el usuario.
2. El trigger `handle_new_user()` (en `schema.sql`) crea automáticamente:
   un `profile`, un `household` ("Mi hogar"), te agrega como `owner` en
   `household_members`, una fila de `settings` con presupuesto en 0, y las
   5 categorías de fábrica.
3. La app resuelve tu `household_id` y carga los datos de ese hogar desde
   Supabase (al principio, vacío salvo las categorías).
4. Si detecta que en ESE dispositivo había datos locales "reales" (no solo
   el demo de ejemplo) y ese hogar todavía no migró nunca, te pregunta si
   querés subirlos. Ver más abajo.

## Migración de datos locales

Al iniciar sesión, la app compara lo que hay en `localStorage` de ese
navegador contra los ids de los datos de ejemplo (`src/data/sampleData.js`).
Si hay algo que no es del demo (productos agregados, compras cerradas,
categorías nuevas, etc.) y el hogar nunca migró, te ofrece subirlo.

- Si aceptás: se suben productos, lista de compras, compra activa (si
  había una en curso), historial de compras reales, eventos de stock
  reales y el presupuesto configurado. Se marca el hogar como migrado
  (columna `households.migrated_from_local`) para no volver a ofrecerlo,
  ni siquiera desde otro dispositivo/navegador con la misma cuenta.
- Si decís "Ahora no": no se borra nada localmente, y en Ajustes → Cuenta
  vas a tener un botón para migrar manualmente cuando quieras (mientras el
  hogar no se haya marcado como migrado).

## Modelo de datos: decisiones y justificaciones

Ver el encabezado de `supabase/schema.sql` para el detalle completo. En
resumen:

- **`categoria` y `unidad` son texto libre** en `products` /
  `purchase_history_items`, no FKs a catálogos. `categories` sí es tabla
  propia (el usuario agrega categorías desde la app); **no se creó tabla
  `units`** porque hoy es una lista fija de 8 valores sin UI para
  editarla — se documenta como mejora futura.
- **`active_purchases` guarda los ítems como JSONB**, no como tabla
  relacional aparte: es un borrador de trabajo que se descarta o se
  vuelca a `purchase_history`/`purchase_history_items` al cerrar.
- **No se crearon tablas para `stores`/`purchase_places` ni
  `benefits`/`discounts`**: no existen en la app actual y esta etapa
  explícitamente no agrega funcionalidades nuevas.

## Estrategia de sincronización (versión simple — limitaciones)

Esta primera versión prioriza simplicidad y corrección por sobre
sincronización en tiempo real. Así funciona:

- **Con sesión y conexión**: cada cambio se aplica primero en el estado
  local (optimista, la UI nunca espera a la red) y se empuja a Supabase en
  segundo plano.
- **Productos, lista de compras, compra activa, categorías, presupuesto**:
  se reescriben completos (`upsert`/reemplazo) en cada cambio. Es simple y
  correcto a la escala de esta app (decenas de productos), aunque no es la
  forma más eficiente posible.
- **Historial de compras y eventos de stock**: son registros de solo
  inserción (nunca se editan), así que se empuja únicamente lo nuevo.
- **Sin conexión**: se seguís usando la app con la última copia
  sincronizada (cacheada en este dispositivo bajo claves separadas de las
  del modo 100% local). Los cambios que hagas mientras estás sin conexión
  quedan en esa copia local.
- **Al recuperar conexión**: la app reenvía el estado actual de las
  entidades "completas" y, para historial/eventos, compara contra lo que
  hay en el servidor y empuja lo que falte.

### Limitaciones conocidas (a propósito, para no sobre-construir esta etapa)

- **No hay sincronización en tiempo real entre dispositivos.** Si dos
  dispositivos están online al mismo tiempo, los cambios de uno no
  aparecen en el otro hasta que ese otro vuelva a cargar la app o se
  desconecte/reconecte. El siguiente paso natural para esto sería usar
  *Supabase Realtime* (canales de Postgres Changes) — no implementado acá.
- **No hay resolución de conflictos real.** Si el mismo hogar se edita
  desde dos dispositivos mientras uno está offline, el que reconecta
  último puede pisar cambios del otro en las entidades que se reescriben
  completas (productos, lista, compra activa, categorías, presupuesto).
  Para esta escala de uso (una familia, pocos cambios simultáneos) el
  riesgo es bajo, pero es una limitación real que vale la pena tener
  presente antes de pensar en "hogares compartidos" activamente usados
  por varias personas a la vez.
- **Los cambios hechos completamente offline en historial/eventos no se
  reintentan automáticamente más que una vez al reconectar.** Si esa
  reconciliación falla (por ejemplo, se corta la conexión de nuevo a mitad
  de camino), hay que volver a intentarlo (recargando la app con
  conexión) — no hay una cola de reintentos persistente.

## Backlog (sigue sin tocarse en esta etapa)

Login social, invitar a otra persona al hogar, Realtime, lugares/precios
por supermercado, beneficios/descuentos, GPS, índice de tranquilidad: todo
eso sigue en `BACKLOG.md`, sin implementar a propósito.
