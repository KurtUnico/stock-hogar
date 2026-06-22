// =========================================================================
// Caché local del modo nube. Importante: usa claves DISTINTAS a las de
// utils/storage.js (que es el modo 100% local, sin cuenta). Así, alguien
// que nunca inicia sesión sigue usando exactamente las mismas claves de
// siempre, sin ningún cambio de comportamiento.
//
// Esta caché es de SOLO LECTURA de respaldo: se escribe automáticamente
// cada vez que se sincroniza con éxito contra Supabase, y se lee cuando hay
// sesión activa pero no hay conexión (para poder seguir usando la app).
// =========================================================================

const PREFIX = 'stockhogar_cache_';

const KEYS = {
  productos: `${PREFIX}productos`,
  categorias: `${PREFIX}categorias`,
  manualItems: `${PREFIX}manual_items`,
  compraActiva: `${PREFIX}compra_activa`,
  historialCompras: `${PREFIX}historial`,
  eventos: `${PREFIX}eventos`,
  stockItems: `${PREFIX}stock_items`,
  preferencias: `${PREFIX}preferencias`,
  fecha: `${PREFIX}fecha`
};

function leer(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn('No se pudo leer caché local', key, err);
    return fallback;
  }
}

function escribir(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('No se pudo guardar caché local', key, err);
  }
}

export function guardarCacheCompleta(datos) {
  escribir(KEYS.productos, datos.productos);
  escribir(KEYS.categorias, datos.categorias);
  escribir(KEYS.manualItems, datos.manualItems);
  escribir(KEYS.compraActiva, datos.compraActiva);
  escribir(KEYS.historialCompras, datos.historialCompras);
  escribir(KEYS.eventos, datos.eventos);
  escribir(KEYS.stockItems, datos.stockItems);
  escribir(KEYS.preferencias, datos.preferencias);
  escribir(KEYS.fecha, new Date().toISOString());
}

export function leerCacheCompleta() {
  return {
    productos: leer(KEYS.productos, []),
    categorias: leer(KEYS.categorias, []),
    manualItems: leer(KEYS.manualItems, []),
    compraActiva: leer(KEYS.compraActiva, null),
    historialCompras: leer(KEYS.historialCompras, []),
    eventos: leer(KEYS.eventos, []),
    stockItems: leer(KEYS.stockItems, []),
    preferencias: leer(KEYS.preferencias, {
      presupuestoMensual: 0,
      moneda: 'UYU',
      diasProximoVencimiento: 30,
      mostrarTranquilidadDashboard: true,
      tranquilidadIncluyePrediccion: true,
      tranquilidadIncluyeVencimientos: true,
      diasParaCompraProxima: 14,
      voyAlSuperIncluyePrediccion: true,
      voyAlSuperIncluyeVencimientos: true,
      voyAlSuperIncluyeCriticos: true
    })
  };
}

export function fechaUltimaCache() {
  return leer(KEYS.fecha, null);
}
