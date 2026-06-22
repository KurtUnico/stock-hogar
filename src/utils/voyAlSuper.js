// =========================================================================
// Modo "Voy al súper". Transforma toda la inteligencia que ya existe
// (estado de stock, productos críticos, vencimientos, predicción de
// consumo, historial de precios) en una propuesta de compra lista para
// usar antes de salir de casa. No reescribe ninguno de esos cálculos:
// getStatus/esProductoCritico (stockLogic.js), productosVencidos/
// productosProximosAVencer (lotes.js), calcularPrediccion (predictions.js)
// y getHistorialProducto (historial.js) se consumen tal cual están, igual
// que ya hace el resto de la app.
// =========================================================================

import { getStatus, getTotal, esProductoCritico, STATUS } from './stockLogic';
import { productosVencidos, productosProximosAVencer, DIAS_PROXIMO_A_VENCER } from './lotes';
import { calcularPrediccion } from './predictions';
import { getHistorialProducto } from './historial';

export const SECCION = {
  URGENTE: 'urgente',
  RECOMENDADO: 'recomendado',
  PROXIMO: 'proximo'
};

export const SECCION_META = {
  [SECCION.URGENTE]: { label: 'Comprar urgente', icono: '🔴' },
  [SECCION.RECOMENDADO]: { label: 'Comprar recomendado', icono: '🟡' },
  [SECCION.PROXIMO]: { label: 'Comprar próximamente', icono: '🟢' }
};

// Días restantes de predicción a partir de los cuales un producto entra a
// "recomendado" (todavía no es urgente, pero conviene anticiparse). Más
// allá de DIAS_PARA_COMPRA_PROXIMA_DEFAULT (configurable) ya ni siquiera
// entra a "próximo" — hay tiempo de sobra.
const DIAS_PREDICCION_RECOMENDADO = 7;
export const DIAS_PARA_COMPRA_PROXIMA_DEFAULT = 14;

// ---------------------------------------------------------------------
// Clasifica UN producto. Devuelve null si no necesita aparecer en la
// propuesta (regla pedida: "no mostrar productos con abundante stock, que
// vencen lejos, o sin necesidad próxima" — una lista corta y útil).
//
// Prioridad de motivos (el primero que aplique gana, no se acumulan):
// más urgente primero, para que la explicación sea siempre la razón más
// importante por la que el producto está en la lista.
// ---------------------------------------------------------------------
function clasificarProducto(producto, contexto) {
  const { stockItems, prediccion, vencidoInfo, proximoInfo, opciones } = contexto;
  const { incluirPrediccion, incluirVencimientos, incluirCriticos, diasParaCompraProxima } = opciones;

  const status = getStatus(producto, stockItems);
  const critico = incluirCriticos && esProductoCritico(producto);

  // --- Urgente ---
  // Agotado (cualquiera) · crítico por agotarse · vencido con stock ya no-OK
  // (lo vencido, en la práctica, deja de contar como stock útil).
  if (status === STATUS.COMPRAR) {
    return {
      seccion: SECCION.URGENTE,
      motivo: critico ? 'Producto crítico agotado.' : 'Producto agotado.'
    };
  }
  if (critico && status === STATUS.POR_AGOTARSE) {
    return { seccion: SECCION.URGENTE, motivo: 'Producto crítico por agotarse.' };
  }
  if (incluirVencimientos && vencidoInfo && status !== STATUS.OK) {
    return {
      seccion: SECCION.URGENTE,
      motivo: critico
        ? 'Producto crítico vencido y con stock bajo.'
        : 'Próximo vencimiento y bajo stock.'
    };
  }

  // --- Recomendado ---
  // Por agotarse (no crítico) · próximo a vencer (con o sin criticidad) ·
  // predicción de consumo en el corto plazo (≤ DIAS_PREDICCION_RECOMENDADO).
  if (status === STATUS.POR_AGOTARSE) {
    return { seccion: SECCION.RECOMENDADO, motivo: 'Producto por agotarse.' };
  }
  if (incluirVencimientos && proximoInfo) {
    return {
      seccion: SECCION.RECOMENDADO,
      motivo: critico
        ? `Producto crítico próximo a vencer (${proximoInfo.dias} día${proximoInfo.dias === 1 ? '' : 's'}).`
        : `Próximo a vencer en ${proximoInfo.dias} día${proximoInfo.dias === 1 ? '' : 's'}.`
    };
  }
  if (incluirPrediccion && prediccion?.estado === 'ok' && prediccion.diasRestantes <= DIAS_PREDICCION_RECOMENDADO) {
    return {
      seccion: SECCION.RECOMENDADO,
      motivo: `Consumo estimado para los próximos ${prediccion.diasRestantes} día${prediccion.diasRestantes === 1 ? '' : 's'}.`
    };
  }

  // --- Próximo ---
  // Status OK, pero la predicción dice que se viene en el horizonte
  // configurado (default 14 días) — "probablemente se necesite pronto".
  if (incluirPrediccion && prediccion?.estado === 'ok' && prediccion.diasRestantes <= diasParaCompraProxima) {
    return {
      seccion: SECCION.PROXIMO,
      motivo: `Consumo estimado para los próximos ${prediccion.diasRestantes} días.`
    };
  }

  // Nada de lo anterior aplicó: stock abundante, vence lejos (o no vence),
  // sin necesidad próxima conocida. No entra a la propuesta.
  return null;
}

// ---------------------------------------------------------------------
// Función principal. Recibe lo mismo que ya recibe el resto del Dashboard/
// Compras — no necesita ningún dato nuevo.
//
// options:
//   incluirPrediccion (default true)
//   incluirVencimientos (default true)
//   incluirCriticos (default true)
//   diasParaCompraProxima (default 14) — preferencias.diasParaCompraProxima
//   umbralDiasVencimiento — mismo umbral de "próximo a vencer" del resto de
//     la app (preferencias.diasProximoVencimiento)
// ---------------------------------------------------------------------
export function generarPropuestaCompra(productos, stockItems, eventos, historialCompras, options = {}) {
  const {
    incluirPrediccion = true,
    incluirVencimientos = true,
    incluirCriticos = true,
    diasParaCompraProxima = DIAS_PARA_COMPRA_PROXIMA_DEFAULT,
    umbralDiasVencimiento = DIAS_PROXIMO_A_VENCER
  } = options;

  const lista = productos || [];
  const opciones = { incluirPrediccion, incluirVencimientos, incluirCriticos, diasParaCompraProxima };

  const mapaVencidos = new Map(
    incluirVencimientos ? productosVencidos(lista, stockItems).map((v) => [v.producto.id, v]) : []
  );
  const mapaProximos = new Map(
    incluirVencimientos
      ? productosProximosAVencer(lista, stockItems, umbralDiasVencimiento).map((v) => [v.producto.id, v])
      : []
  );

  const clasificados = { urgente: [], recomendado: [], proximo: [] };

  lista.forEach((producto) => {
    const prediccion = incluirPrediccion ? calcularPrediccion(producto, eventos || [], stockItems) : null;
    const resultado = clasificarProducto(producto, {
      stockItems,
      prediccion,
      vencidoInfo: mapaVencidos.get(producto.id) || null,
      proximoInfo: mapaProximos.get(producto.id) || null,
      opciones
    });
    if (!resultado) return;

    const historial = getHistorialProducto(producto.id, historialCompras || []);
    const cantidadSugerida = Math.max(1, Math.round((producto.stockMinimo || 1) - getTotal(producto, stockItems))) || 1;
    const precioEstimado = historial?.ultimoPrecio || historial?.precioPromedio || 0;

    clasificados[resultado.seccion].push({
      producto,
      motivo: resultado.motivo,
      // Respeta incluirCriticos: si el usuario apagó esa señal, no se
      // muestra como crítico aunque el producto lo sea (consistente con
      // que tampoco influyó en cómo se clasificó).
      critico: incluirCriticos && esProductoCritico(producto),
      cantidadSugerida,
      precioEstimado,
      tienePrecio: precioEstimado > 0,
      subtotalEstimado: Number((precioEstimado * cantidadSugerida).toFixed(2))
    });
  });

  // Dentro de cada sección, críticos primero (mismo criterio de prioridad
  // que ya se usa en la lista de compras desde v1.6).
  const ordenar = (items) => [...items].sort((a, b) => (b.critico ? 1 : 0) - (a.critico ? 1 : 0));

  const urgentes = ordenar(clasificados.urgente);
  const recomendados = ordenar(clasificados.recomendado);
  const proximos = ordenar(clasificados.proximo);

  const sumarSeccion = (items) => {
    const conPrecio = items.filter((i) => i.tienePrecio);
    const subtotal = conPrecio.reduce((s, i) => s + i.subtotalEstimado, 0);
    return {
      subtotal: Number(subtotal.toFixed(2)),
      completo: items.length > 0 && conPrecio.length === items.length,
      cantidadConPrecio: conPrecio.length,
      cantidadSinPrecio: items.length - conPrecio.length
    };
  };

  const costoUrgente = sumarSeccion(urgentes);
  const costoRecomendado = sumarSeccion(recomendados);
  const costoProximo = sumarSeccion(proximos);
  const costoTotal = {
    subtotal: Number((costoUrgente.subtotal + costoRecomendado.subtotal).toFixed(2)),
    // El total sugerido (para "crear compra activa") es urgente + recomendado;
    // "próximo" es informativo, todavía no se sugiere comprarlo ahora.
    completo: costoUrgente.completo && costoRecomendado.completo,
    cantidadSinPrecio: costoUrgente.cantidadSinPrecio + costoRecomendado.cantidadSinPrecio
  };

  return {
    urgentes,
    recomendados,
    proximos,
    costoUrgente,
    costoRecomendado,
    costoProximo,
    costoTotal,
    totalProductos: urgentes.length + recomendados.length + proximos.length,
    vacia: urgentes.length === 0 && recomendados.length === 0 && proximos.length === 0
  };
}

// ---------------------------------------------------------------------
// Impacto en presupuesto: cuánto se llevaría el gasto del mes si se
// confirma la compra sugerida (urgente + recomendado, igual que costoTotal).
// No duplica getGastoMes (historial.js): lo recibe ya calculado.
// ---------------------------------------------------------------------
export function calcularImpactoPresupuesto(costoTotalSubtotal, gastadoMes, presupuestoMensual) {
  const presupuesto = Number(presupuestoMensual) || 0;
  if (presupuesto <= 0) {
    return { presupuesto: 0, disponible: null, superaPresupuesto: false, impactoTotal: gastadoMes + costoTotalSubtotal };
  }
  const disponible = presupuesto - gastadoMes;
  const impactoTotal = gastadoMes + costoTotalSubtotal;
  return {
    presupuesto,
    disponible: Number(disponible.toFixed(2)),
    impactoTotal: Number(impactoTotal.toFixed(2)),
    superaPresupuesto: impactoTotal > presupuesto
  };
}
