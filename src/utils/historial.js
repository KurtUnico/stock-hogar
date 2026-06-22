// Utilidades sobre el historial de compras: precio histórico por producto
// y gasto del mes (para el presupuesto).

export function getHistorialProducto(productoId, historialCompras) {
  const apariciones = [];
  historialCompras.forEach((compra) => {
    compra.items.forEach((item) => {
      if (item.productoId === productoId) {
        apariciones.push({ ...item, fecha: compra.fecha });
      }
    });
  });

  if (apariciones.length === 0) return null;

  apariciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ultimo = apariciones[0];
  const precioPromedio =
    apariciones.reduce((suma, a) => suma + Number(a.precioUnitario || 0), 0) / apariciones.length;

  return {
    ultimoPrecio: Number(ultimo.precioUnitario || 0),
    fechaUltimoPrecio: ultimo.fecha,
    precioPromedio: Number(precioPromedio.toFixed(2)),
    cantidadCompras: apariciones.length
  };
}

export function getGastoMes(historialCompras, fechaReferencia = new Date()) {
  const mes = fechaReferencia.getMonth();
  const anio = fechaReferencia.getFullYear();
  return historialCompras
    .filter((c) => {
      const f = new Date(c.fecha);
      return f.getMonth() === mes && f.getFullYear() === anio;
    })
    .reduce((suma, c) => suma + Number(c.total || 0), 0);
}

export function formatMoneda(valor, moneda = 'UYU') {
  const decimales = moneda === 'USD' || moneda === 'EUR' ? 2 : 0;
  try {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    }).format(Number(valor) || 0);
  } catch (err) {
    return `${moneda} ${(Number(valor) || 0).toFixed(decimales)}`;
  }
}

export function formatFechaHora(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return fecha.toLocaleString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
