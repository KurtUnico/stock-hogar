// Catálogo de eventos de movimiento de stock. Cada vez que algo cambia en
// un producto, queda un registro acá. Es la materia prima de las
// predicciones: sin eventos no hay forma de saber "cada cuánto se consume".

export const TIPO_EVENTO = {
  CREACION: 'creacion',
  INCREMENTO: 'incremento',
  DISMINUCION: 'disminucion',
  COMPRA_CERRADA: 'compra_cerrada',
  AJUSTE_MANUAL: 'ajuste_manual',
  AGOTADO: 'agotado',
  AGREGADO_LISTA: 'agregado_lista'
};

export function crearEvento(productoId, tipo, cantidad, fecha = new Date().toISOString()) {
  return {
    id: crypto.randomUUID(),
    productoId,
    tipo,
    cantidad,
    fecha
  };
}

export function eventosDeProducto(eventos, productoId) {
  return eventos.filter((e) => e.productoId === productoId);
}
