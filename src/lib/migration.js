import * as cloud from './cloudRepo';
import * as local from '../utils/storage';
import { SAMPLE_PRODUCTS, SAMPLE_MANUAL_SHOPPING_ITEMS } from '../data/sampleData';
import { DEFAULT_CATEGORIES } from '../data/categories';

// =========================================================================
// Migración localStorage -> Supabase. Se ofrece una sola vez por usuario,
// la primera vez que inicia sesión y hay datos locales que parecen reales
// (no solo el demo de fábrica). Ver hayDatosLocalesParaMigrar() más abajo
// para el criterio exacto.
// =========================================================================

const FLAG_LOCAL_PREFIX = 'stockhogar_migrated_user_';

const IDS_SEED_PRODUCTOS = new Set(SAMPLE_PRODUCTS.map((p) => p.id));
const IDS_SEED_MANUALES = new Set(SAMPLE_MANUAL_SHOPPING_ITEMS.map((m) => m.id));

function flagLocalKey(userId) {
  return `${FLAG_LOCAL_PREFIX}${userId}`;
}

// Atajo rápido (sin red): si ya migramos antes desde este mismo navegador,
// no hace falta ni preguntarle al servidor.
export function yaMigroEnEsteNavegador(userId) {
  return localStorage.getItem(flagLocalKey(userId)) === 'true';
}

function marcarMigradoEnEsteNavegador(userId) {
  localStorage.setItem(flagLocalKey(userId), 'true');
}

// Heurística para distinguir "datos de ejemplo sin tocar" de "el usuario
// realmente usó la app en este dispositivo": comparamos contra los ids de
// la semilla. Cualquier id que no sea de la semilla (o un dato de la
// semilla que ya no está, osea se editó/borró) cuenta como "hay algo real".
export function hayDatosLocalesParaMigrar() {
  const productos = local.loadProducts();
  const manualItems = local.loadManualItems();
  const historial = local.loadPurchaseHistory();
  const eventos = local.loadStockEvents();
  const categorias = local.loadCategories();
  const stockItems = local.loadStockItems();

  const productosDistintos =
    productos.length !== SAMPLE_PRODUCTS.length || productos.some((p) => !IDS_SEED_PRODUCTOS.has(p.id));
  const manualesDistintos =
    manualItems.length !== SAMPLE_MANUAL_SHOPPING_ITEMS.length ||
    manualItems.some((m) => !IDS_SEED_MANUALES.has(m.id));
  const historialDistinto = historial.some((h) => !String(h.id).startsWith('demo_compra_'));
  const eventosDistintos = eventos.some((e) => !String(e.id).startsWith('demo_evt_'));
  const categoriasDistintas =
    categorias.length !== DEFAULT_CATEGORIES.length || categorias.some((c) => !DEFAULT_CATEGORIES.includes(c));
  const lotesDistintos = stockItems.some((l) => !String(l.id).startsWith('demo_lote_'));

  return (
    productosDistintos || manualesDistintos || historialDistinto || eventosDistintos ||
    categoriasDistintas || lotesDistintos
  );
}

// Chequeo completo (server-side, autoridad real) de si corresponde ofrecer
// la migración: hay datos locales reales Y el hogar todavía no migró nunca.
export async function debeOfrecerMigracion(userId, householdId) {
  if (!hayDatosLocalesParaMigrar()) return false;
  if (yaMigroEnEsteNavegador(userId)) return false;
  const yaMigrado = await cloud.yaSeMigroAlHogar(householdId);
  return !yaMigrado;
}

function esViolacionDeDuplicado(err) {
  // Código de Postgres para unique_violation. Si ya existe, lo tratamos
  // como éxito (migración idempotente) en vez de cortar todo el proceso.
  return err?.code === '23505';
}

export async function migrarDatosLocales(userId, householdId) {
  const productos = local.loadProducts();
  const categorias = local.loadCategories();
  const manualItems = local.loadManualItems();
  const compraActiva = local.loadActivePurchase();
  const historial = local.loadPurchaseHistory();
  const eventos = local.loadStockEvents();
  const stockItems = local.loadStockItems();
  const preferencias = local.loadPreferences();

  for (const nombre of categorias) {
    await cloud.agregarCategoriaCloud(householdId, nombre);
  }

  if (productos.length > 0) {
    await cloud.guardarProductos(householdId, productos);
  }
  if (stockItems.length > 0) {
    await cloud.guardarLotes(householdId, stockItems);
  }
  if (manualItems.length > 0) {
    await cloud.reemplazarListaManual(householdId, manualItems);
  }
  if (compraActiva) {
    await cloud.guardarCompraActiva(householdId, compraActiva);
  }

  // Solo lo "real" (no el demo de fábrica) — y tolerando que ya exista por
  // si esta función se llegó a correr antes parcialmente.
  const historialReal = historial.filter((h) => !String(h.id).startsWith('demo_compra_'));
  for (const registro of historialReal) {
    try {
      await cloud.insertarCompraCerrada(householdId, registro);
    } catch (err) {
      if (!esViolacionDeDuplicado(err)) throw err;
    }
  }

  const eventosReales = eventos.filter((e) => !String(e.id).startsWith('demo_evt_'));
  if (eventosReales.length > 0) {
    try {
      await cloud.insertarEventos(householdId, eventosReales);
    } catch (err) {
      if (!esViolacionDeDuplicado(err)) throw err;
    }
  }

  await cloud.guardarPreferenciasCloud(householdId, preferencias);

  await cloud.marcarHogarComoMigrado(householdId);
  marcarMigradoEnEsteNavegador(userId);
}

// Para "descartar" el aviso sin migrar (el usuario dice que no, por ahora):
// no marcamos el hogar como migrado en el server (así si entra desde otro
// dispositivo le seguimos preguntando), pero sí dejamos de insistir en
// ESTE navegador en esta sesión.
export function descartarMigracionEnEsteNavegador(userId) {
  localStorage.setItem(flagLocalKey(userId), 'true');
}
