// Datos de ejemplo para que la app no arranque vacía.
// Se cargan una sola vez, la primera vez que se abre la app (ver storage.js).
//
// Desde la evolución de lotes, los productos NO tienen más cantidadUso ni
// cantidadDespensa: esas cantidades viven en SAMPLE_STOCK_ITEMS (lotes),
// ver construirLotesDemo() más abajo.
//
// Desde la evolución de productos críticos, cada producto tiene esCritico
// (boolean, default false). En la demo marcamos como críticos algunos
// ejemplos típicos (pañales, toallitas húmedas, leche) para que la
// funcionalidad sea visible desde el primer uso, sin que esto implique
// ninguna regla automática: en la app real es 100% configurable.
export const SAMPLE_PRODUCTS = [
  { id: 'p1', nombre: 'Arroz', categoria: 'Almacén', unidad: 'kg', stockMinimo: 1, notificacionActiva: true, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-18T10:00:00.000Z' },
  { id: 'p2', nombre: 'Aceite de girasol', categoria: 'Almacén', unidad: 'botella', stockMinimo: 1, notificacionActiva: true, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-19T10:00:00.000Z' },
  { id: 'p3', nombre: 'Fideos', categoria: 'Almacén', unidad: 'paquete', stockMinimo: 2, notificacionActiva: true, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-17T10:00:00.000Z' },
  { id: 'p4', nombre: 'Yerba', categoria: 'Almacén', unidad: 'kg', stockMinimo: 1, notificacionActiva: true, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-20T10:00:00.000Z' },
  { id: 'p5', nombre: 'Detergente', categoria: 'Limpieza', unidad: 'botella', stockMinimo: 1, notificacionActiva: true, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-14T10:00:00.000Z' },
  { id: 'p6', nombre: 'Lavandina', categoria: 'Limpieza', unidad: 'botella', stockMinimo: 1, notificacionActiva: false, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-16T10:00:00.000Z' },
  { id: 'p7', nombre: 'Esponjas', categoria: 'Limpieza', unidad: 'paquete', stockMinimo: 1, notificacionActiva: true, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-12T10:00:00.000Z' },
  { id: 'p8', nombre: 'Papel higiénico', categoria: 'Higiene personal', unidad: 'rollo', stockMinimo: 4, notificacionActiva: true, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-20T10:00:00.000Z' },
  { id: 'p9', nombre: 'Shampoo', categoria: 'Higiene personal', unidad: 'botella', stockMinimo: 1, notificacionActiva: true, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-15T10:00:00.000Z' },
  { id: 'p10', nombre: 'Jabón de tocador', categoria: 'Higiene personal', unidad: 'unidad', stockMinimo: 2, notificacionActiva: false, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-13T10:00:00.000Z' },
  { id: 'p11', nombre: 'Pañales talle 3', categoria: 'Bebé/Niño', unidad: 'paquete', stockMinimo: 2, notificacionActiva: true, requiereVencimiento: false, esCritico: true, ultimaActualizacion: '2026-06-19T10:00:00.000Z' },
  { id: 'p12', nombre: 'Toallitas húmedas', categoria: 'Bebé/Niño', unidad: 'paquete', stockMinimo: 1, notificacionActiva: true, requiereVencimiento: false, esCritico: true, ultimaActualizacion: '2026-06-18T10:00:00.000Z' },
  { id: 'p13', nombre: 'Pilas AA', categoria: 'Otros', unidad: 'paquete', stockMinimo: 1, notificacionActiva: false, requiereVencimiento: false, esCritico: false, ultimaActualizacion: '2026-06-11T10:00:00.000Z' },
  // Perecederos, para que la demo muestre vencimientos desde el primer uso.
  { id: 'p14', nombre: 'Leche', categoria: 'Almacén', unidad: 'litro', stockMinimo: 2, notificacionActiva: true, requiereVencimiento: true, esCritico: true, ultimaActualizacion: '2026-06-20T10:00:00.000Z' },
  { id: 'p15', nombre: 'Queso fresco', categoria: 'Almacén', unidad: 'unidad', stockMinimo: 1, notificacionActiva: true, requiereVencimiento: true, esCritico: false, ultimaActualizacion: '2026-06-17T10:00:00.000Z' }
];

export const SAMPLE_MANUAL_SHOPPING_ITEMS = [
  { id: 'm1', nombre: 'Bolsas de residuos grandes', cantidad: 1, comprado: false, manual: true }
];

// --- Demo de lotes/eventos/historial/presupuesto -----------------------
// Todo esto es contenido de ejemplo para que, apenas se abre la app por
// primera vez, las pantallas de Stock, Predicciones, Historial, Presupuesto
// y Vencimientos ya muestren algo (en vez de aparecer vacías hasta que el
// usuario use la app un tiempo). Las fechas se calculan relativas a "ahora"
// para que el demo no quede desactualizado con el paso del tiempo.
function haceDias(dias) {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}
function enDias(dias) {
  return haceDias(-dias);
}

// Lotes de ejemplo: para los 13 productos "de toda la vida" reproducen las
// cantidades que tenían antes de existir los lotes (mismo demo, mismo
// comportamiento), sin vencimiento. Para Leche y Queso fresco, con
// vencimientos reales (uno por vencer pronto, otro ya vencido) para poder
// probar esa parte de la app sin tener que cargar nada a mano.
export function construirLotesDemo() {
  let id = 0;
  const lote = (productId, ubicacion, cantidad, opciones = {}) => ({
    id: `demo_lote_${id++}`,
    productId,
    ubicacion,
    cantidad,
    fechaCompra: opciones.fechaCompra || haceDias(10),
    fechaVencimiento: opciones.fechaVencimiento || null,
    precioUnitario: opciones.precioUnitario ?? null,
    observaciones: null,
    activo: true,
    fechaCreacion: opciones.fechaCompra || haceDias(10),
    fechaActualizacion: opciones.fechaCompra || haceDias(10)
  });

  const lotesSimples = [];
  // [productId, cantidadUso, cantidadDespensa] — igual que el demo anterior.
  const cantidadesOriginales = [
    ['p1', 1, 2], ['p2', 1, 0], ['p3', 0, 1], ['p4', 1, 1], ['p5', 0, 0],
    ['p6', 1, 0], ['p7', 1, 2], ['p8', 2, 4], ['p9', 1, 0], ['p10', 1, 0],
    ['p11', 0, 1], ['p12', 1, 1], ['p13', 1, 0]
  ];
  cantidadesOriginales.forEach(([productId, uso, despensa]) => {
    if (uso > 0) lotesSimples.push(lote(productId, 'en_uso', uso));
    if (despensa > 0) lotesSimples.push(lote(productId, 'despensa', despensa));
  });

  const lotesPerecederos = [
    // Leche: una unidad en uso por vencer en 3 días, una en despensa con más margen.
    lote('p14', 'en_uso', 1, { fechaVencimiento: enDias(3), fechaCompra: haceDias(4), precioUnitario: 65 }),
    lote('p14', 'despensa', 1, { fechaVencimiento: enDias(20), fechaCompra: haceDias(1), precioUnitario: 65 }),
    // Queso fresco: vencido hace 2 días, para probar la detección de vencidos.
    lote('p15', 'despensa', 1, { fechaVencimiento: haceDias(2), fechaCompra: haceDias(12), precioUnitario: 210 })
  ];

  return [...lotesSimples, ...lotesPerecederos];
}

// Eventos de stock (consumo) para que Arroz, Papel higiénico y Detergente
// ya tengan una predicción calculable con distintos niveles de confianza.
export function construirEventosDemo() {
  let id = 0;
  const nuevo = (productoId, tipo, cantidad, dias) => ({
    id: `demo_evt_${id++}`,
    productoId,
    tipo,
    cantidad,
    fecha: haceDias(dias)
  });

  return [
    // Arroz (p1): consumo parejo -> confianza media
    nuevo('p1', 'disminucion', 1, 28),
    nuevo('p1', 'disminucion', 1, 21),
    nuevo('p1', 'disminucion', 1, 14),
    // Papel higiénico (p8): varios registros -> confianza alta
    nuevo('p8', 'disminucion', 1, 27),
    nuevo('p8', 'disminucion', 1, 22),
    nuevo('p8', 'disminucion', 1, 17),
    nuevo('p8', 'disminucion', 1, 12),
    nuevo('p8', 'disminucion', 1, 6),
    nuevo('p8', 'compra_cerrada', 6, 30),
    // Detergente (p5): un solo registro -> confianza baja
    nuevo('p5', 'disminucion', 1, 8)
  ];
}

// Un par de compras cerradas de ejemplo (con precios), para que el badge
// de "último precio", el detalle de producto y el presupuesto del mes
// tengan datos reales para mostrar.
export function construirHistorialDemo() {
  return [
    {
      id: 'demo_compra_1',
      fecha: haceDias(6),
      total: 370,
      items: [
        { productoId: 'p1', nombre: 'Arroz', categoria: 'Almacén', cantidad: 2, unidad: 'kg', precioUnitario: 95, subtotal: 190 },
        { productoId: 'p2', nombre: 'Aceite de girasol', categoria: 'Almacén', cantidad: 1, unidad: 'botella', precioUnitario: 180, subtotal: 180 }
      ]
    },
    {
      id: 'demo_compra_2',
      fecha: haceDias(22),
      total: 260,
      items: [
        { productoId: 'p5', nombre: 'Detergente', categoria: 'Limpieza', cantidad: 1, unidad: 'botella', precioUnitario: 140, subtotal: 140 },
        { productoId: null, nombre: 'Pan', categoria: '', cantidad: 1, unidad: 'unidad', precioUnitario: 120, subtotal: 120 }
      ]
    }
  ];
}

export const SAMPLE_PREFERENCES = {
  presupuestoMensual: 12000,
  moneda: 'UYU',
  diasProximoVencimiento: 30,
  mostrarTranquilidadDashboard: true,
  tranquilidadIncluyePrediccion: true,
  tranquilidadIncluyeVencimientos: true,
  diasParaCompraProxima: 14,
  voyAlSuperIncluyePrediccion: true,
  voyAlSuperIncluyeVencimientos: true,
  voyAlSuperIncluyeCriticos: true
};
