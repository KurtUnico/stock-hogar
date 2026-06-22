// =========================================================================
// Índice de Tranquilidad del Hogar. Resume en un solo número (0-100) qué
// tan abastecido está el hogar, combinando lo que ya existe: estado de
// stock (stockLogic.js), productos críticos (stockLogic.js), vencimientos
// (lotes.js / wasteIntelligence.js) y predicción de consumo
// (predictions.js). No reemplaza ni reescribe ninguno de esos cálculos:
// solo los consume y los traduce a una penalización transparente.
//
// Filosofía (pedida explícitamente): nada de IA/ML ni fórmulas complejas.
// Empieza en 100 y resta una penalización fija por cada situación
// encontrada, con los críticos pesando más que los normales. Cada resta
// queda registrada en "factores", así el resultado siempre se puede
// explicar — nunca es una caja negra.
// =========================================================================

import { getStatus, getResumen, esProductoCritico, STATUS } from './stockLogic';
import { productosVencidos, productosProximosAVencer, DIAS_PROXIMO_A_VENCER } from './lotes';
import { calcularPrediccion } from './predictions';

// ---------------------------------------------------------------------
// Penalizaciones. Números fijos y documentados (no una fórmula oculta).
// Los productos críticos penalizan más que los normales para el mismo
// problema — es el único "peso" que existe en este cálculo.
// ---------------------------------------------------------------------
export const PENALIZACIONES = {
  AGOTADO_CRITICO: 12,
  POR_AGOTARSE_CRITICO: 6,
  AGOTADO_NORMAL: 4,
  POR_AGOTARSE_NORMAL: 2,
  VENCIDO_CRITICO: 10,
  PROXIMO_A_VENCER_CRITICO: 5,
  VENCIDO_NORMAL: 3,
  PROXIMO_A_VENCER_NORMAL: 1.5,
  PREDICCION_CRITICA_URGENTE: 8, // crítico que la predicción dice que se agota en pocos días
  PREDICCION_VARIOS_URGENTES: 5  // varios productos (no necesariamente críticos) por agotarse pronto
};

// A partir de cuántos días restantes la predicción se considera "urgente"
// para penalizar tranquilidad (no confundir con el umbral de vencimiento).
const DIAS_PREDICCION_URGENTE = 5;
// A partir de cuántos productos con predicción urgente se suma la
// penalización "varios urgentes" (además de las individuales de críticos).
const UMBRAL_VARIOS_URGENTES = 3;

export const ESTADOS_TRANQUILIDAD = [
  { min: 95, id: 'excelente', label: 'Excelente', color: 'ok' },
  { min: 80, id: 'bien', label: 'Bien', color: 'ok' },
  { min: 60, id: 'atencion', label: 'Atención', color: 'warn' },
  { min: 40, id: 'preocupante', label: 'Preocupante', color: 'warn' },
  { min: 0, id: 'critico', label: 'Crítico', color: 'danger' }
];

export function obtenerEstadoTranquilidad(puntaje) {
  return ESTADOS_TRANQUILIDAD.find((e) => puntaje >= e.min) || ESTADOS_TRANQUILIDAD[ESTADOS_TRANQUILIDAD.length - 1];
}

// ---------------------------------------------------------------------
// Cálculo principal. Recibe lo mismo que ya recibe el Dashboard — no
// necesita ningún dato nuevo.
//
// options:
//   incluirPrediccion (default true)  — si se apaga, la predicción no
//                                        penaliza (sigue calculándose el
//                                        resto del índice igual).
//   incluirVencimientos (default true) — idem para vencidos/próximos.
//   umbralDias — mismo umbral de "próximo a vencer" que usa el resto de la
//                app (preferencias.diasProximoVencimiento).
//
// Devuelve { puntaje, estado, factores, explicacion, resumen }.
// - factores: lista de { tipo, etiqueta, cantidad, penalizacion, critico },
//   uno por cada situación que restó puntos. Pensada para renderizar
//   "factores negativos" en el detalle.
// - explicacion: lista de strings en lenguaje natural (subset de
//   factores, listo para mostrar como "Motivos:" en la tarjeta resumida).
// - resumen: positivos calculados aparte (productos críticos OK, sin
//   vencidos, etc.), para "factores positivos" en el detalle.
// ---------------------------------------------------------------------
export function calcularTranquilidad(productos, stockItems, eventos, options = {}) {
  const {
    incluirPrediccion = true,
    incluirVencimientos = true,
    umbralDias = DIAS_PROXIMO_A_VENCER
  } = options;

  const lista = productos || [];

  // Caso especial: hogar sin productos cargados. Matemáticamente el resto
  // del cálculo daría 100 (ninguna penalización aplica), pero eso sería
  // engañoso — "Excelente" no tiene sentido si no hay nada que evaluar
  // todavía. Se devuelve un estado neutro y explícito en vez de un 100
  // falso.
  if (lista.length === 0) {
    return {
      puntaje: null,
      estado: { id: 'sin-datos', label: 'Sin datos', color: 'neutro' },
      factores: [],
      explicacion: [],
      positivos: [],
      detalle: {
        agotadosCriticos: 0, porAgotarseCriticos: 0, agotadosNormales: 0, porAgotarseNormales: 0,
        vencidosCriticos: 0, vencidosNormales: 0, proximosCriticos: 0, proximosNormales: 0,
        criticosPrediccionUrgente: 0, totalPrediccionUrgente: 0, totalProductos: 0
      }
    };
  }

  const factores = [];
  let puntaje = 100;

  // etiquetaSingular/etiquetaPlural en vez de concatenar "s": frases como
  // "producto por agotarse" no pluralizan agregando una letra al final
  // ("producto por agotarses" sería incorrecto), así que cada factor trae
  // su propia forma plural explícita.
  const restar = (tipo, etiquetaSingular, etiquetaPlural, cantidad, penalizacionUnitaria, critico) => {
    if (cantidad <= 0) return;
    const penalizacion = cantidad * penalizacionUnitaria;
    puntaje -= penalizacion;
    const etiqueta = cantidad === 1 ? etiquetaSingular : etiquetaPlural;
    factores.push({ tipo, etiqueta, etiquetaSingular, etiquetaPlural, cantidad, penalizacion: Number(penalizacion.toFixed(1)), critico });
  };

  // -----------------------------------------------------------------
  // 1. Estado de stock (agotado / por agotarse), separado por crítico/normal.
  // Reusa getStatus() — no se reimplementa el criterio de estado.
  // -----------------------------------------------------------------
  let agotadosCriticos = 0;
  let porAgotarseCriticos = 0;
  let agotadosNormales = 0;
  let porAgotarseNormales = 0;
  let criticosOk = 0;

  lista.forEach((p) => {
    const status = getStatus(p, stockItems);
    const critico = esProductoCritico(p);
    if (status === STATUS.COMPRAR) {
      if (critico) agotadosCriticos += 1;
      else agotadosNormales += 1;
    } else if (status === STATUS.POR_AGOTARSE) {
      if (critico) porAgotarseCriticos += 1;
      else porAgotarseNormales += 1;
    } else if (critico) {
      criticosOk += 1;
    }
  });

  restar('agotado-critico', 'producto crítico agotado', 'productos críticos agotados', agotadosCriticos, PENALIZACIONES.AGOTADO_CRITICO, true);
  restar('por-agotarse-critico', 'producto crítico por agotarse', 'productos críticos por agotarse', porAgotarseCriticos, PENALIZACIONES.POR_AGOTARSE_CRITICO, true);
  restar('agotado-normal', 'producto agotado', 'productos agotados', agotadosNormales, PENALIZACIONES.AGOTADO_NORMAL, false);
  restar('por-agotarse-normal', 'producto por agotarse', 'productos por agotarse', porAgotarseNormales, PENALIZACIONES.POR_AGOTARSE_NORMAL, false);

  // -----------------------------------------------------------------
  // 2. Vencimientos: baja la tranquilidad aunque haya stock. Reusa
  // productosVencidos/productosProximosAVencer (lotes.js) — no se
  // reimplementa el cálculo de vencido/próximo a vencer.
  // -----------------------------------------------------------------
  let vencidosCriticos = 0;
  let vencidosNormales = 0;
  let proximosCriticos = 0;
  let proximosNormales = 0;

  if (incluirVencimientos) {
    productosVencidos(lista, stockItems).forEach(({ producto }) => {
      if (esProductoCritico(producto)) vencidosCriticos += 1;
      else vencidosNormales += 1;
    });
    productosProximosAVencer(lista, stockItems, umbralDias).forEach(({ producto }) => {
      if (esProductoCritico(producto)) proximosCriticos += 1;
      else proximosNormales += 1;
    });

    restar('vencido-critico', 'producto crítico vencido', 'productos críticos vencidos', vencidosCriticos, PENALIZACIONES.VENCIDO_CRITICO, true);
    restar('proximo-critico', 'producto crítico próximo a vencer', 'productos críticos próximos a vencer', proximosCriticos, PENALIZACIONES.PROXIMO_A_VENCER_CRITICO, true);
    restar('vencido-normal', 'producto vencido', 'productos vencidos', vencidosNormales, PENALIZACIONES.VENCIDO_NORMAL, false);
    restar('proximo-normal', 'producto próximo a vencer', 'productos próximos a vencer', proximosNormales, PENALIZACIONES.PROXIMO_A_VENCER_NORMAL, false);
  }

  // -----------------------------------------------------------------
  // 3. Predicción de consumo: baja si un crítico se agota pronto, o si
  // varios productos (en general) se agotan pronto. Reusa
  // calcularPrediccion() (predictions.js) — no se toca su algoritmo, solo
  // se consume el resultado producto por producto, igual que ya hace
  // Dashboard.jsx.
  // -----------------------------------------------------------------
  let criticosPrediccionUrgente = 0;
  let totalPrediccionUrgente = 0;

  if (incluirPrediccion && Array.isArray(eventos)) {
    lista.forEach((p) => {
      const prediccion = calcularPrediccion(p, eventos, stockItems);
      if (prediccion.estado !== 'ok') return;
      if (prediccion.diasRestantes <= DIAS_PREDICCION_URGENTE) {
        totalPrediccionUrgente += 1;
        if (esProductoCritico(p)) criticosPrediccionUrgente += 1;
      }
    });

    restar('prediccion-critico-urgente', 'producto crítico que se agota pronto', 'productos críticos que se agotan pronto', criticosPrediccionUrgente, PENALIZACIONES.PREDICCION_CRITICA_URGENTE, true);
    if (totalPrediccionUrgente >= UMBRAL_VARIOS_URGENTES) {
      restar('prediccion-varios-urgentes', 'varios productos que se agotan pronto', 'varios productos que se agotan pronto', 1, PENALIZACIONES.PREDICCION_VARIOS_URGENTES, false);
    }
  }

  puntaje = Math.max(0, Math.min(100, Math.round(puntaje)));
  const estado = obtenerEstadoTranquilidad(puntaje);

  // Explicación en lenguaje natural: una línea por factor, ordenada de
  // mayor a menor impacto (lo que más pesa primero). f.etiqueta ya viene en
  // singular o plural correcto desde restar() — no se concatena nada acá.
  const explicacion = [...factores]
    .sort((a, b) => b.penalizacion - a.penalizacion)
    .map((f) => `${f.cantidad} ${f.etiqueta}`);

  // Factores positivos: lo que está bien, para el detalle (sección 8 del
  // pedido). No penalizan nada, son solo informativos.
  const resumenStock = getResumen(lista, stockItems);
  const positivos = [];
  const totalCriticos = criticosOk + agotadosCriticos + porAgotarseCriticos;
  if (totalCriticos > 0 && agotadosCriticos === 0 && porAgotarseCriticos === 0) {
    positivos.push(`${criticosOk} producto${criticosOk === 1 ? '' : 's'} crítico${criticosOk === 1 ? '' : 's'} OK`);
  }
  if (incluirVencimientos && vencidosCriticos === 0 && vencidosNormales === 0) {
    positivos.push('Sin productos vencidos');
  }
  if (resumenStock.comprar === 0 && resumenStock.porAgotarse === 0) {
    positivos.push('Buen nivel de stock en toda la despensa');
  }

  return {
    puntaje,
    estado,
    factores,
    explicacion,
    positivos,
    // Datos crudos, por si el detalle quiere mostrar números sin re-parsear
    // la explicación en texto.
    detalle: {
      agotadosCriticos,
      porAgotarseCriticos,
      agotadosNormales,
      porAgotarseNormales,
      vencidosCriticos,
      vencidosNormales,
      proximosCriticos,
      proximosNormales,
      criticosPrediccionUrgente,
      totalPrediccionUrgente,
      totalProductos: lista.length
    }
  };
}
