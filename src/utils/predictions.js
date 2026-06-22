// Predicción de consumo, versión simple (regla de tres, no machine learning).
//
// Idea: miramos los eventos de "disminución" (y los ajustes manuales hacia
// abajo) de un producto, sumamos cuánto se consumió y en cuántos días,
// sacamos un promedio diario, y con eso estimamos cuántos días le quedan
// al stock actual.
//
// Cuantos más eventos haya, más confiamos en el número.

import { getTotal } from './stockLogic';
import { TIPO_EVENTO } from './stockEvents';

const MS_POR_DIA = 1000 * 60 * 60 * 24;

const CONFIANZA = {
  BAJA: 'baja',
  MEDIA: 'media',
  ALTA: 'alta'
};

function calcularConfianza(cantidadRegistros) {
  if (cantidadRegistros > 5) return CONFIANZA.ALTA;
  if (cantidadRegistros >= 3) return CONFIANZA.MEDIA;
  return CONFIANZA.BAJA;
}

export function calcularPrediccion(producto, eventos, stockItems) {
  const eventosProducto = eventos.filter((e) => e.productoId === producto.id);

  // Señales de consumo real: bajó el stock por uso, o se ajustó manualmente
  // hacia abajo. No usamos "creación" ni "agregado a lista", esos no son consumo.
  const señalesConsumo = eventosProducto.filter(
    (e) =>
      e.tipo === TIPO_EVENTO.DISMINUCION ||
      (e.tipo === TIPO_EVENTO.AJUSTE_MANUAL && e.cantidad < 0)
  );

  const registrosRelevantes =
    eventosProducto.filter((e) =>
      [TIPO_EVENTO.DISMINUCION, TIPO_EVENTO.COMPRA_CERRADA, TIPO_EVENTO.AJUSTE_MANUAL].includes(e.tipo)
    ).length;

  if (señalesConsumo.length < 1) {
    return {
      estado: 'sin-datos',
      confianza: null,
      mensaje: 'Aún no hay suficiente historial para predecir este producto.'
    };
  }

  const ordenados = [...señalesConsumo].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const primero = new Date(ordenados[0].fecha).getTime();
  const ultimo = new Date(ordenados[ordenados.length - 1].fecha).getTime();
  // Si todos los eventos son del mismo momento, usamos 1 día como piso
  // para no dividir por (casi) cero.
  const diasTranscurridos = Math.max(1, (ultimo - primero) / MS_POR_DIA);
  const totalConsumido = ordenados.reduce((suma, e) => suma + Math.abs(e.cantidad), 0);

  const consumoDiario = totalConsumido / diasTranscurridos;

  if (consumoDiario <= 0) {
    return {
      estado: 'sin-datos',
      confianza: null,
      mensaje: 'Aún no hay suficiente historial para predecir este producto.'
    };
  }

  const stockActual = getTotal(producto, stockItems);
  const diasRestantes = Math.max(0, Math.round(stockActual / consumoDiario));
  const fechaAgotamiento = new Date(Date.now() + diasRestantes * MS_POR_DIA);
  const confianza = calcularConfianza(registrosRelevantes);

  let mensaje;
  if (diasRestantes <= 0) {
    mensaje = 'Según tu consumo habitual, este producto ya debería estar agotándose.';
  } else if (diasRestantes === 1) {
    mensaje = 'Según tu consumo habitual, este producto se agotaría mañana.';
  } else {
    mensaje = `Según tu consumo habitual, este producto se agotaría en aproximadamente ${diasRestantes} días.`;
  }

  return {
    estado: 'ok',
    confianza,
    consumoDiario: Number(consumoDiario.toFixed(2)),
    diasRestantes,
    fechaAgotamiento: fechaAgotamiento.toISOString(),
    mensaje
  };
}

export function mensajeProximaCompra(prediccion) {
  if (!prediccion || prediccion.estado !== 'ok') return null;
  const dias = prediccion.diasRestantes;
  if (dias <= 2) return 'Probablemente necesites comprarlo en los próximos días.';
  if (dias <= 9) return 'Probablemente necesites comprarlo la próxima semana.';
  if (dias <= 31) return 'Probablemente necesites comprarlo este mes.';
  return 'Por ahora no hace falta comprarlo.';
}

export { CONFIANZA };
