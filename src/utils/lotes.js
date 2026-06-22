// =========================================================================
// Lotes (StockItem) y vencimientos.
//
// Un StockItem representa una unidad física de stock: "este paquete de
// fideos", "esta botella de leche que compré el martes y vence el 15".
// Reemplaza a los viejos cantidadUso/cantidadDespensa como fuente de verdad
// del stock (ver utils/stockLogic.js).
//
// Forma de un StockItem:
// {
//   id, productId,
//   ubicacion: 'en_uso' | 'despensa',
//   cantidad,
//   fechaCompra,        // ISO o null
//   fechaVencimiento,    // ISO o null — opcional siempre
//   precioUnitario,      // o null
//   observaciones,        // o null
//   activo,               // false = "consumido/eliminado", se conserva para historial liviano
//   fechaCreacion, fechaActualizacion
// }
// =========================================================================

export const UBICACION = {
  EN_USO: 'en_uso',
  DESPENSA: 'despensa'
};

const MS_POR_DIA = 1000 * 60 * 60 * 24;
export const DIAS_PROXIMO_A_VENCER = 30;

export function crearLote({ productId, ubicacion, cantidad, fechaVencimiento = null, fechaCompra = null, precioUnitario = null, observaciones = null }) {
  const ahora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    productId,
    ubicacion,
    cantidad: Number(cantidad) || 0,
    fechaCompra: fechaCompra || ahora,
    fechaVencimiento: fechaVencimiento || null,
    precioUnitario: precioUnitario === null || precioUnitario === undefined ? null : Number(precioUnitario),
    observaciones: observaciones || null,
    activo: true,
    fechaCreacion: ahora,
    fechaActualizacion: ahora
  };
}

export function diasParaVencer(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  const ms = new Date(fechaVencimiento).getTime() - Date.now();
  return Math.ceil(ms / MS_POR_DIA);
}

export function estaVencido(fechaVencimiento) {
  const dias = diasParaVencer(fechaVencimiento);
  return dias !== null && dias < 0;
}

export function estaProximoAVencer(fechaVencimiento, umbralDias = DIAS_PROXIMO_A_VENCER) {
  const dias = diasParaVencer(fechaVencimiento);
  return dias !== null && dias >= 0 && dias <= umbralDias;
}

// Orden FEFO (First Expire First Out): vencen primero -> vencen después ->
// sin vencimiento al final. Es el orden "correcto" para consumir o para
// mostrar una lista de lotes de un producto.
export function ordenarFEFO(lotes) {
  return [...lotes].sort((a, b) => {
    if (!a.fechaVencimiento && !b.fechaVencimiento) {
      return new Date(a.fechaCreacion || 0) - new Date(b.fechaCreacion || 0);
    }
    if (!a.fechaVencimiento) return 1;
    if (!b.fechaVencimiento) return -1;
    return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento);
  });
}

// Próximo vencimiento entre los lotes activos (de cualquier ubicación) de
// un producto. null si no hay ninguno con fecha.
export function proximoVencimiento(lotes) {
  const conFecha = lotes.filter((l) => l.activo !== false && l.fechaVencimiento);
  if (conFecha.length === 0) return null;
  return ordenarFEFO(conFecha)[0].fechaVencimiento;
}

// Productos (no lotes) con al menos un lote vencido / próximo a vencer.
// Devuelve [{ producto, lote, lotes, cantidadTotal, dias }]: "lote" es el más
// urgente (compatibilidad con quien ya lo usaba así), "lotes" trae TODOS los
// que matchean la condición (puede haber más de uno vencido a la vez) y
// "cantidadTotal" es la suma de cantidad entre esos lotes.
export function productosVencidos(productos, stockItems) {
  return productosConAlerta(productos, stockItems, (dias) => dias !== null && dias < 0);
}

export function productosProximosAVencer(productos, stockItems, umbralDias = DIAS_PROXIMO_A_VENCER) {
  return productosConAlerta(productos, stockItems, (dias) => dias !== null && dias >= 0 && dias <= umbralDias);
}

function productosConAlerta(productos, stockItems, condicion) {
  const resultado = [];
  productos.forEach((producto) => {
    const lotesDelProducto = (stockItems || []).filter((l) => l.productId === producto.id && l.activo !== false && l.fechaVencimiento);
    const lotesQueMatchean = lotesDelProducto.filter((l) => condicion(diasParaVencer(l.fechaVencimiento)));
    if (lotesQueMatchean.length === 0) return;
    const ordenados = ordenarFEFO(lotesQueMatchean);
    const masUrgente = ordenados[0];
    const dias = diasParaVencer(masUrgente.fechaVencimiento);
    const cantidadTotal = lotesQueMatchean.reduce((suma, l) => suma + (Number(l.cantidad) || 0), 0);
    resultado.push({ producto, lote: masUrgente, lotes: ordenados, cantidadTotal, dias });
  });
  return resultado.sort((a, b) => a.dias - b.dias);
}

export function formatFechaCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ---------------------------------------------------------------------
// Helpers para los botones rápidos +/- de cantidad (StockList). Operan
// sobre un "lote genérico" (sin vencimiento) por producto+ubicación, para
// no obligar a cargar un vencimiento solo para sumar/restar una unidad.
// La gestión fina (vencimientos, mover, eliminar lotes puntuales) vive en
// el detalle del producto.
// ---------------------------------------------------------------------

// "+1" (o +N): suma a un lote genérico existente, o crea uno nuevo.
export function incrementarGenerico(stockItems, productId, ubicacion, cantidad = 1) {
  const idx = stockItems.findIndex(
    (l) => l.productId === productId && l.ubicacion === ubicacion && l.activo !== false && !l.fechaVencimiento
  );
  if (idx >= 0) {
    const actualizado = [...stockItems];
    const ahora = new Date().toISOString();
    actualizado[idx] = { ...actualizado[idx], cantidad: actualizado[idx].cantidad + cantidad, fechaActualizacion: ahora };
    return actualizado;
  }
  return [...stockItems, crearLote({ productId, ubicacion, cantidad })];
}

// "-1" (o -N), estrategia FEFO: descuenta del lote que vence primero entre
// los que tienen stock en esa ubicación (y si ninguno tiene vencimiento, del
// más viejo). Si un lote llega a 0, se desactiva (no se borra: se conserva
// como referencia liviana de que existió). Devuelve { stockItems, consumido }.
export function consumirFEFO(stockItems, productId, ubicacion, cantidad = 1) {
  const candidatos = stockItems.filter(
    (l) => l.productId === productId && l.ubicacion === ubicacion && l.activo !== false && l.cantidad > 0
  );
  if (candidatos.length === 0) return { stockItems, consumido: false, cantidadConsumida: 0 };

  const objetivo = ordenarFEFO(candidatos)[0];
  const cantidadConsumida = Math.min(cantidad, objetivo.cantidad);
  const restante = objetivo.cantidad - cantidadConsumida;
  const ahora = new Date().toISOString();
  const actualizado = stockItems.map((l) => {
    if (l.id !== objetivo.id) return l;
    return { ...l, cantidad: restante, activo: restante > 0, fechaActualizacion: ahora };
  });
  return { stockItems: actualizado, consumido: true, cantidadConsumida };
}
