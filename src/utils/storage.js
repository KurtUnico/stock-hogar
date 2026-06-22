import { DEFAULT_CATEGORIES } from '../data/categories';
import {
  SAMPLE_PRODUCTS,
  SAMPLE_MANUAL_SHOPPING_ITEMS,
  construirEventosDemo,
  construirHistorialDemo,
  construirLotesDemo,
  SAMPLE_PREFERENCES
} from '../data/sampleData';
import { crearLote } from './lotes';

// Todo el acceso a localStorage pasa por acá. Si el día de mañana se quiere
// migrar a IndexedDB (por ejemplo para guardar fotos de productos), solo
// hay que reescribir estas funciones: el resto de la app no sabe ni le
// importa dónde se guardan los datos.

const KEYS = {
  PRODUCTS: 'stockhogar_products',
  CATEGORIES: 'stockhogar_categories',
  MANUAL_ITEMS: 'stockhogar_manual_items',
  LAST_NOTIFY: 'stockhogar_last_notify',
  SEEDED: 'stockhogar_seeded',
  // --- agregado en la evolución "compra activa / predicciones" ---
  ACTIVE_PURCHASE: 'stockhogar_active_purchase',
  PURCHASE_HISTORY: 'stockhogar_purchase_history',
  STOCK_EVENTS: 'stockhogar_stock_events',
  PREFERENCES: 'stockhogar_preferences',
  MIGRATED_V2: 'stockhogar_migrated_v2',
  // --- agregado en la evolución "lotes y vencimientos" ---
  STOCK_ITEMS: 'stockhogar_stock_items',
  MIGRATED_V3: 'stockhogar_migrated_v3',
  // --- agregado en la evolución "productos críticos" ---
  MIGRATED_V4: 'stockhogar_migrated_v4'
};

export const DEFAULT_PREFERENCES = {
  presupuestoMensual: 0,
  moneda: 'UYU',
  diasProximoVencimiento: 30,
  // --- agregado en la evolución "índice de tranquilidad" ---
  mostrarTranquilidadDashboard: true,
  tranquilidadIncluyePrediccion: true,
  tranquilidadIncluyeVencimientos: true,
  // --- agregado en la evolución "Voy al súper" ---
  diasParaCompraProxima: 14,
  voyAlSuperIncluyePrediccion: true,
  voyAlSuperIncluyeVencimientos: true,
  voyAlSuperIncluyeCriticos: true
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('No se pudo leer', key, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('No se pudo guardar', key, err);
  }
}

// La primera vez que se abre la app, sembramos datos de ejemplo: productos,
// categorías, lista de compras, lotes, Y TAMBIÉN eventos/historial/
// presupuesto demo, para que ninguna pantalla arranque vacía.
export function ensureSeed() {
  const yaSembrado = read(KEYS.SEEDED, false);
  if (!yaSembrado) {
    write(KEYS.PRODUCTS, SAMPLE_PRODUCTS);
    write(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    write(KEYS.MANUAL_ITEMS, SAMPLE_MANUAL_SHOPPING_ITEMS);
    write(KEYS.ACTIVE_PURCHASE, null);
    write(KEYS.PURCHASE_HISTORY, construirHistorialDemo());
    write(KEYS.STOCK_EVENTS, construirEventosDemo());
    write(KEYS.STOCK_ITEMS, construirLotesDemo());
    write(KEYS.PREFERENCES, SAMPLE_PREFERENCES);
    write(KEYS.SEEDED, true);
    // Una instalación 100% nueva ya nace con todas las claves pobladas: no
    // necesita pasar por ninguna de las migraciones de versiones anteriores.
    write(KEYS.MIGRATED_V2, true);
    write(KEYS.MIGRATED_V3, true);
    write(KEYS.MIGRATED_V4, true);
  }
}

// Para quienes ya tenían la app instalada ANTES de la evolución "compra
// activa / predicciones" (es decir, ya tienen SEEDED=true pero nunca
// pasaron por un ensureSeed con las claves v2): crea esas claves nuevas con
// valores vacíos/neutros, SIN tocar lo que ya existía. Es seguro llamarla
// siempre: si ya se migró (o si la instalación nació directo con todo
// poblado), no hace nada.
export function ensureMigrationV2() {
  const yaMigrado = read(KEYS.MIGRATED_V2, false);
  if (yaMigrado) return;
  if (localStorage.getItem(KEYS.ACTIVE_PURCHASE) === null) write(KEYS.ACTIVE_PURCHASE, null);
  if (localStorage.getItem(KEYS.PURCHASE_HISTORY) === null) write(KEYS.PURCHASE_HISTORY, []);
  if (localStorage.getItem(KEYS.STOCK_EVENTS) === null) write(KEYS.STOCK_EVENTS, []);
  if (localStorage.getItem(KEYS.PREFERENCES) === null) write(KEYS.PREFERENCES, DEFAULT_PREFERENCES);
  write(KEYS.MIGRATED_V2, true);
}

// =========================================================================
// Migración a LOTES (v3). Esta es la pieza más sensible de esta evolución:
// nadie debe perder stock al actualizar. Toma cada producto existente con
// cantidadUso/cantidadDespensa y genera StockItem equivalentes (sin
// vencimiento, porque esos campos nunca lo registraron), y LUEGO saca esos
// dos campos del producto (el stock pasa a calcularse 100% desde los lotes,
// ver utils/stockLogic.js).
//
// Es idempotente y defensiva:
//  - Si ya corrió antes (MIGRATED_V3=true), no hace nada.
//  - Si por algún motivo ya hay stock_items guardados pero el flag no llegó
//    a setearse, tampoco regenera nada (evita duplicar lotes).
// =========================================================================
export function ensureMigrationV3() {
  const yaMigrado = read(KEYS.MIGRATED_V3, false);
  if (yaMigrado) return;

  const stockItemsExistentes = localStorage.getItem(KEYS.STOCK_ITEMS);
  if (stockItemsExistentes === null) {
    const productos = read(KEYS.PRODUCTS, []);
    const lotesGenerados = [];

    const productosActualizados = productos.map((p) => {
      const { cantidadUso, cantidadDespensa, ...resto } = p;
      const uso = Number(cantidadUso) || 0;
      const despensa = Number(cantidadDespensa) || 0;

      if (uso > 0) {
        lotesGenerados.push(
          crearLote({ productId: p.id, ubicacion: 'en_uso', cantidad: uso, fechaCompra: p.ultimaActualizacion })
        );
      }
      if (despensa > 0) {
        lotesGenerados.push(
          crearLote({ productId: p.id, ubicacion: 'despensa', cantidad: despensa, fechaCompra: p.ultimaActualizacion })
        );
      }

      return { ...resto, requiereVencimiento: resto.requiereVencimiento ?? false };
    });

    write(KEYS.PRODUCTS, productosActualizados);
    write(KEYS.STOCK_ITEMS, lotesGenerados);
  }

  write(KEYS.MIGRATED_V3, true);
}

// =========================================================================
// Migración a PRODUCTOS CRÍTICOS (v4). La más simple de las migraciones
// hasta ahora: un solo campo nuevo, boolean, con default false. No requiere
// tocar ningún otro dato (lotes, eventos, historial quedan intactos).
// Idempotente: si ya corrió, no hace nada.
// =========================================================================
export function ensureMigrationV4() {
  const yaMigrado = read(KEYS.MIGRATED_V4, false);
  if (yaMigrado) return;

  const productos = read(KEYS.PRODUCTS, []);
  const productosActualizados = productos.map((p) => ({
    ...p,
    esCritico: p.esCritico ?? false
  }));
  write(KEYS.PRODUCTS, productosActualizados);

  write(KEYS.MIGRATED_V4, true);
}

export function loadProducts() {
  return read(KEYS.PRODUCTS, SAMPLE_PRODUCTS);
}
export function saveProducts(products) {
  write(KEYS.PRODUCTS, products);
}

export function loadCategories() {
  return read(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
}
export function saveCategories(categories) {
  write(KEYS.CATEGORIES, categories);
}

export function loadManualItems() {
  return read(KEYS.MANUAL_ITEMS, SAMPLE_MANUAL_SHOPPING_ITEMS);
}
export function saveManualItems(items) {
  write(KEYS.MANUAL_ITEMS, items);
}

export function loadLastNotifyDate() {
  return read(KEYS.LAST_NOTIFY, null);
}
export function saveLastNotifyDate(dateStr) {
  write(KEYS.LAST_NOTIFY, dateStr);
}

// --- Lotes (StockItem) ---
export function loadStockItems() {
  return read(KEYS.STOCK_ITEMS, []);
}
export function saveStockItems(items) {
  write(KEYS.STOCK_ITEMS, items);
}

// --- Compra activa ---
export function loadActivePurchase() {
  return read(KEYS.ACTIVE_PURCHASE, null);
}
export function saveActivePurchase(compra) {
  write(KEYS.ACTIVE_PURCHASE, compra);
}

// --- Historial de compras ---
export function loadPurchaseHistory() {
  return read(KEYS.PURCHASE_HISTORY, []);
}
export function savePurchaseHistory(historial) {
  write(KEYS.PURCHASE_HISTORY, historial);
}

// --- Eventos de stock (para predicción) ---
export function loadStockEvents() {
  return read(KEYS.STOCK_EVENTS, []);
}
export function saveStockEvents(eventos) {
  write(KEYS.STOCK_EVENTS, eventos);
}

// --- Preferencias (presupuesto, moneda) ---
export function loadPreferences() {
  // Merge con los defaults: si alguien ya tenía preferencias guardadas de
  // antes de un campo nuevo (ej. diasProximoVencimiento), igual lo recibe
  // con un valor razonable en vez de undefined.
  const guardadas = read(KEYS.PREFERENCES, DEFAULT_PREFERENCES);
  return { ...DEFAULT_PREFERENCES, ...guardadas };
}
export function savePreferences(prefs) {
  write(KEYS.PREFERENCES, prefs);
}

// Para "Restablecer datos de ejemplo" en Ajustes: vuelve TODO al estado de
// demo completo (incluye lotes/historial/eventos/presupuesto de ejemplo,
// no solo productos), para que sea consistente con lo que ve alguien en una
// instalación nueva.
export function resetToSampleData() {
  write(KEYS.PRODUCTS, SAMPLE_PRODUCTS);
  write(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
  write(KEYS.MANUAL_ITEMS, SAMPLE_MANUAL_SHOPPING_ITEMS);
  write(KEYS.ACTIVE_PURCHASE, null);
  write(KEYS.PURCHASE_HISTORY, construirHistorialDemo());
  write(KEYS.STOCK_EVENTS, construirEventosDemo());
  write(KEYS.STOCK_ITEMS, construirLotesDemo());
  write(KEYS.PREFERENCES, SAMPLE_PREFERENCES);
}

// Para "Borrar todo" en Ajustes: deja productos, lotes, lista, compra
// activa, historial, eventos y presupuesto completamente en blanco. Las
// categorías vuelven a las de fábrica (no a una lista vacía) para que el
// formulario de producto siga teniendo opciones para elegir.
export function clearAllData() {
  write(KEYS.PRODUCTS, []);
  write(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
  write(KEYS.MANUAL_ITEMS, []);
  write(KEYS.ACTIVE_PURCHASE, null);
  write(KEYS.PURCHASE_HISTORY, []);
  write(KEYS.STOCK_EVENTS, []);
  write(KEYS.STOCK_ITEMS, []);
  write(KEYS.PREFERENCES, DEFAULT_PREFERENCES);
}
