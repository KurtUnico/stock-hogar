// =========================================================================
// Inteligencia por vencimiento. Capa que combina lotes + productos +
// (opcionalmente) predicción de consumo para generar recomendaciones útiles
// y prevenir desperdicio. No duplica lógica: todo se apoya en las
// primitivas de utils/lotes.js (FEFO, vencido, próximo a vencer) y
// utils/stockLogic.js (estado/total de un producto).
//
// Nada de esto muta datos: son funciones puras de lectura, pensadas para
// llamarse desde Dashboard, el detalle de producto y la compra activa.
// =========================================================================

import { getStockProducto, getStatus, lotesDeProducto, STATUS } from './stockLogic';
import {
  DIAS_PROXIMO_A_VENCER,
  diasParaVencer,
  estaVencido,
  estaProximoAVencer,
  ordenarFEFO,
  productosVencidos,
  productosProximosAVencer
} from './lotes';

// Re-exportamos estas dos para que el resto de la app pueda importar TODO
// lo de vencimientos desde un solo lugar si quiere (Dashboard, etc. las usan).
export { productosVencidos, productosProximosAVencer };

// ---------------------------------------------------------------------
// 3. Recomendaciones FEFO entre productos: "consumir primero".
// Prioridad: vencidos (más atrasados primero) -> próximos a vencer (más
// urgentes primero) -> sin vencimiento (lote más antiguo primero), solo
// como relleno si hace falta completar la lista.
// ---------------------------------------------------------------------
export function ordenConsumoRecomendado(productos, stockItems, umbralDias = DIAS_PROXIMO_A_VENCER, limite = 5) {
  const vencidos = productosVencidos(productos, stockItems);
  const proximos = productosProximosAVencer(productos, stockItems, umbralDias);
  const combinados = [...vencidos, ...proximos];

  if (combinados.length < limite) {
    const idsConAlerta = new Set(combinados.map((x) => x.producto.id));
    const sinAlerta = productos
      .filter((p) => !idsConAlerta.has(p.id))
      .map((p) => {
        const lotes = lotesDeProducto(stockItems, p.id).filter((l) => l.cantidad > 0);
        if (lotes.length === 0) return null;
        const masViejo = ordenarFEFO(lotes)[0];
        const cantidadTotal = lotes.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
        return { producto: p, lote: masViejo, lotes, cantidadTotal, dias: null };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.lote.fechaCreacion || 0) - new Date(b.lote.fechaCreacion || 0));
    combinados.push(...sinAlerta.slice(0, limite - combinados.length));
  }

  return combinados.slice(0, limite);
}

// ---------------------------------------------------------------------
// 4. Riesgo de desperdicio agregado: cuántos productos/unidades están
// vencidos o por vencer, y el valor económico comprometido SI hay precio
// cargado en esos lotes (si no hay ningún precio, solo se informa la
// cantidad de unidades).
// ---------------------------------------------------------------------
export function calcularRiesgoDesperdicio(productos, stockItems, umbralDias = DIAS_PROXIMO_A_VENCER) {
  const vencidos = productosVencidos(productos, stockItems);
  const proximos = productosProximosAVencer(productos, stockItems, umbralDias);

  const unidadesVencidas = vencidos.reduce((s, v) => s + v.cantidadTotal, 0);
  const unidadesProximas = proximos.reduce((s, v) => s + v.cantidadTotal, 0);

  let valorEconomico = 0;
  let unidadesConPrecio = 0;
  let unidadesSinPrecio = 0;
  [...vencidos, ...proximos].forEach(({ lotes }) => {
    lotes.forEach((l) => {
      const cantidad = Number(l.cantidad) || 0;
      if (l.precioUnitario !== null && l.precioUnitario !== undefined) {
        valorEconomico += cantidad * Number(l.precioUnitario);
        unidadesConPrecio += cantidad;
      } else {
        unidadesSinPrecio += cantidad;
      }
    });
  });

  return {
    productosVencidos: vencidos.length,
    productosProximos: proximos.length,
    unidadesVencidas,
    unidadesProximas,
    unidadesTotales: unidadesVencidas + unidadesProximas,
    valorEconomico,
    unidadesConPrecio,
    unidadesSinPrecio,
    // true solo si TODAS las unidades en riesgo tienen precio cargado —
    // así el monto que mostramos es el real, no uno parcial disfrazado de total.
    valorEconomicoCompleto: unidadesSinPrecio === 0 && unidadesConPrecio > 0,
    tieneValorEconomico: unidadesConPrecio > 0
  };
}

// ---------------------------------------------------------------------
// 5a. Recomendación de compra por producto: "ya tenés de sobra y se te
// vence, no compres más" — solo tiene sentido si el producto NO necesita
// reposición (si ya hace falta comprarlo, sería un mensaje contradictorio).
// ---------------------------------------------------------------------
export function recomendacionCompra(producto, stockItems, umbralDias = DIAS_PROXIMO_A_VENCER) {
  if (getStatus(producto, stockItems) !== STATUS.OK) return null;

  const { total } = getStockProducto(producto, stockItems);
  if (total <= 0) return null;

  const lotesProximos = lotesDeProducto(stockItems, producto.id).filter(
    (l) => l.cantidad > 0 && l.fechaVencimiento && estaProximoAVencer(l.fechaVencimiento, umbralDias)
  );
  if (lotesProximos.length === 0) return null;

  const cantidadProxima = lotesProximos.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const diasMin = Math.max(0, Math.min(...lotesProximos.map((l) => diasParaVencer(l.fechaVencimiento))));

  return {
    producto,
    total,
    cantidadProxima,
    diasMin,
    mensaje: `No comprar más ${producto.nombre}.`,
    detalle: `Tenés ${total} unidad${total === 1 ? '' : 'es'}. ${cantidadProxima} vence${cantidadProxima === 1 ? '' : 'n'} en los próximos ${diasMin} día${diasMin === 1 ? '' : 's'}.`
  };
}

export function recomendacionesCompra(productos, stockItems, umbralDias = DIAS_PROXIMO_A_VENCER) {
  return productos.map((p) => recomendacionCompra(p, stockItems, umbralDias)).filter(Boolean);
}

// ---------------------------------------------------------------------
// 5b. Nota informativa (no bloqueante) para un ítem de la compra activa:
// "ya tenés stock de esto que vence pronto". A diferencia de
// recomendacionCompra, esta SIEMPRE se calcula (sin importar el estado del
// producto), porque en compra activa el ítem puede estar ahí por otros
// motivos (lo agregó la lista automática, o a mano) y la idea es solo
// informar, nunca bloquear ni contradecir la lista de compras.
// ---------------------------------------------------------------------
export function notaVencimientoEnCompra(productoId, stockItems, umbralDias = DIAS_PROXIMO_A_VENCER) {
  if (!productoId) return null;
  const lotes = (stockItems || []).filter(
    (l) =>
      l.productId === productoId &&
      l.activo !== false &&
      l.cantidad > 0 &&
      l.fechaVencimiento &&
      estaProximoAVencer(l.fechaVencimiento, umbralDias)
  );
  if (lotes.length === 0) return null;
  const cantidadProxima = lotes.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const diasMin = Math.max(0, Math.min(...lotes.map((l) => diasParaVencer(l.fechaVencimiento))));
  return {
    cantidadProxima,
    diasMin,
    mensaje: `Ya tenés ${cantidadProxima} unidad${cantidadProxima === 1 ? '' : 'es'} que vence${cantidadProxima === 1 ? '' : 'n'} en los próximos ${diasMin} día${diasMin === 1 ? '' : 's'}.`
  };
}

// ---------------------------------------------------------------------
// 9. Complementa (no reemplaza) la predicción de consumo con la señal de
// vencimiento: si lo que tenés va a vencer ANTES de que lo consumas al
// ritmo actual, hay riesgo real de desperdicio.
// ---------------------------------------------------------------------
export function complementarPrediccion(producto, prediccion, stockItems, umbralDias = DIAS_PROXIMO_A_VENCER) {
  if (!prediccion || prediccion.estado !== 'ok') return null;

  const lotesConFecha = lotesDeProducto(stockItems, producto.id).filter((l) => l.cantidad > 0 && l.fechaVencimiento);
  if (lotesConFecha.length === 0) return null;

  const masUrgente = ordenarFEFO(lotesConFecha)[0];
  const diasVence = diasParaVencer(masUrgente.fechaVencimiento);
  if (diasVence === null) return null;

  if (estaVencido(masUrgente.fechaVencimiento)) {
    return {
      tipo: 'riesgo',
      mensaje: 'Parte de tu stock ya venció antes de poder consumirlo. Revisá los lotes y descartá lo que corresponda.'
    };
  }

  if (diasVence < prediccion.diasRestantes) {
    return {
      tipo: 'riesgo',
      mensaje: `Te quedan ${prediccion.diasRestantes} días de consumo, pero una parte del stock vence en ${diasVence} día${diasVence === 1 ? '' : 's'}. Probablemente desperdicies stock si mantenés el ritmo actual.`
    };
  }

  if (diasVence <= umbralDias) {
    return {
      tipo: 'info',
      mensaje: `Vas a alcanzar a consumirlo: vence en ${diasVence} día${diasVence === 1 ? '' : 's'} y a tu ritmo actual te quedan ${prediccion.diasRestantes} días de stock.`
    };
  }

  return null;
}
