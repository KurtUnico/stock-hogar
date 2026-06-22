// Toda la lógica de "qué estado tiene un producto" vive acá, en un solo lugar,
// para que el resto de los componentes solo consuman el resultado.
//
// Desde la evolución de lotes, el stock YA NO se lee de producto.cantidadUso /
// producto.cantidadDespensa (esos campos no existen más en productos nuevos,
// y se eliminan al migrar los viejos — ver utils/storage.js ensureMigrationV3
// y utils/lotes.js). El stock se calcula sumando los StockItem (lotes)
// activos de ese producto, agrupados por ubicación.

export const STATUS = {
  OK: 'ok',
  POR_AGOTARSE: 'por-agotarse',
  COMPRAR: 'comprar'
};

export const STATUS_META = {
  [STATUS.OK]: { label: 'OK', color: 'verde' },
  [STATUS.POR_AGOTARSE]: { label: 'Por agotarse', color: 'amarillo' },
  [STATUS.COMPRAR]: { label: 'Comprar', color: 'rojo' }
};

// Lotes activos (no eliminados) de un producto, sin importar ubicación.
export function lotesDeProducto(stockItems, productoId) {
  return (stockItems || []).filter((l) => l.productId === productoId && l.activo !== false);
}

// Desglose de stock por ubicación + total, a partir de los lotes.
export function getStockProducto(producto, stockItems) {
  const lotes = lotesDeProducto(stockItems, producto.id);
  let enUso = 0;
  let enDespensa = 0;
  lotes.forEach((l) => {
    const cantidad = Number(l.cantidad) || 0;
    if (l.ubicacion === 'en_uso') enUso += cantidad;
    else if (l.ubicacion === 'despensa') enDespensa += cantidad;
  });
  return { enUso, enDespensa, total: enUso + enDespensa };
}

export function getTotal(producto, stockItems) {
  return getStockProducto(producto, stockItems).total;
}

export function getStatus(producto, stockItems) {
  const total = getTotal(producto, stockItems);
  const minimo = Number(producto.stockMinimo || 0);
  if (total < minimo) return STATUS.COMPRAR;
  if (total === minimo) return STATUS.POR_AGOTARSE;
  return STATUS.OK;
}

export function getResumen(productos, stockItems) {
  const resumen = { total: productos.length, ok: 0, porAgotarse: 0, comprar: 0 };
  productos.forEach((p) => {
    const status = getStatus(p, stockItems);
    if (status === STATUS.OK) resumen.ok += 1;
    else if (status === STATUS.POR_AGOTARSE) resumen.porAgotarse += 1;
    else resumen.comprar += 1;
  });
  return resumen;
}

// Para la barrita de "nivel del frasco" que se usa en todo el diseño:
// qué porcentaje del mínimo recomendado (con un techo razonable) hay disponible.
export function getNivelPorcentaje(producto, stockItems) {
  const total = getTotal(producto, stockItems);
  const minimo = Number(producto.stockMinimo || 0);
  if (minimo <= 0) return total > 0 ? 100 : 0;
  const techo = minimo * 2; // a partir del doble del mínimo, se considera "lleno"
  const pct = Math.round((total / techo) * 100);
  return Math.max(4, Math.min(100, pct));
}

export function debeComprarse(producto, stockItems) {
  const status = getStatus(producto, stockItems);
  return status === STATUS.POR_AGOTARSE || status === STATUS.COMPRAR;
}

// =========================================================================
// Productos críticos. "Crítico" es un boolean configurable por el usuario
// (producto.esCritico), sin reglas automáticas ni categorías precargadas:
// el usuario decide qué no puede faltar nunca (pañales, medicamentos, etc.).
// No reemplaza el status (OK/por-agotarse/comprar): es una capa de
// prioridad visual y de orden que se combina con el status existente.
//
// Preparado para una futura evolución a "nivelCriticidad" (no implementada
// todavía, ver BACKLOG.md): el resto de la app debería consumir SIEMPRE
// esProductoCritico() en vez de leer producto.esCritico directo, para que
// el día de mañana solo haya que cambiar esta función.
// =========================================================================
export function esProductoCritico(producto) {
  return Boolean(producto?.esCritico);
}

export function obtenerProductosCriticos(productos) {
  return (productos || []).filter(esProductoCritico);
}

// Resumen de estado (OK / por agotarse / comprar) pero solo de los
// productos críticos — para la tarjeta dedicada del Dashboard.
export function obtenerResumenCriticos(productos, stockItems) {
  const criticos = obtenerProductosCriticos(productos);
  return getResumen(criticos, stockItems);
}

export function formatFecha(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
