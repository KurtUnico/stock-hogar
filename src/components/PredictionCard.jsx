import React from 'react';
import { mensajeProximaCompra } from '../utils/predictions';

const ICONO_CONFIANZA = { baja: '🔹', media: '🔸', alta: '🔶' };

// variant="card": fila compacta para listados (Dashboard).
// variant="box": bloque más completo para el detalle de un producto.
// critico: prop opcional (default false) — no cambia el algoritmo de
// predicción (utils/predictions.js no se toca), solo agrega prioridad
// visual cuando el producto está marcado como crítico.
export default function PredictionCard({ nombre, prediccion, variant = 'card', critico = false }) {
  if (!prediccion || prediccion.estado === 'sin-datos') {
    if (variant === 'box') {
      return (
        <div className="prediction-box">
          <p>📊 Aún no hay suficiente historial para predecir este producto.</p>
          <p className="prediction-box__meta">
            Se necesitan al menos un par de movimientos de stock (usar el producto o comprarlo) para
            empezar a estimar.
          </p>
        </div>
      );
    }
    return null;
  }

  if (variant === 'box') {
    const proxima = mensajeProximaCompra(prediccion);
    return (
      <div className={`prediction-box ${critico ? 'prediction-box--riesgo' : ''}`}>
        <p>{critico ? '⚠️ Producto crítico — ' : '📊 '}{prediccion.mensaje}</p>
        {proxima && <p className="prediction-box__meta">{proxima}</p>}
        <p className="prediction-box__meta">
          Confianza:{' '}
          <span className={`confidence-pill confidence-pill--${prediccion.confianza}`}>
            {prediccion.confianza}
          </span>{' '}
          · consumo estimado {prediccion.consumoDiario}/día
        </p>
      </div>
    );
  }

  return (
    <div className={`prediction-card ${critico ? 'prediction-card--critico' : ''}`}>
      <span className="prediction-card__icon">{critico ? '⚠️' : (ICONO_CONFIANZA[prediccion.confianza] || '📊')}</span>
      <div style={{ flex: 1 }}>
        <div className="prediction-card__name">{critico && '⭐ '}{nombre}</div>
        <div className="prediction-card__text">{prediccion.mensaje}</div>
      </div>
      <span className={`confidence-pill confidence-pill--${prediccion.confianza}`}>
        {prediccion.confianza}
      </span>
    </div>
  );
}
