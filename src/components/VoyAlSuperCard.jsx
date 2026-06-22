import React from 'react';
import { formatMoneda } from '../utils/historial';

export default function VoyAlSuperCard({ propuesta, moneda = 'UYU', onVerPropuesta }) {
  if (propuesta.vacia) return null;

  return (
    <div className="voy-al-super-card">
      <div className="voy-al-super-card__top">
        <span className="voy-al-super-card__title">🛒 Próxima compra</span>
      </div>
      <div className="voy-al-super-card__stats">
        {propuesta.urgentes.length > 0 && (
          <div className="voy-al-super-card__stat voy-al-super-card__stat--danger">
            <span className="voy-al-super-card__stat-value">{propuesta.urgentes.length}</span>
            <span className="voy-al-super-card__stat-label">Urgentes</span>
          </div>
        )}
        {propuesta.recomendados.length > 0 && (
          <div className="voy-al-super-card__stat voy-al-super-card__stat--warn">
            <span className="voy-al-super-card__stat-value">{propuesta.recomendados.length}</span>
            <span className="voy-al-super-card__stat-label">Recomendados</span>
          </div>
        )}
        {propuesta.proximos.length > 0 && (
          <div className="voy-al-super-card__stat voy-al-super-card__stat--ok">
            <span className="voy-al-super-card__stat-value">{propuesta.proximos.length}</span>
            <span className="voy-al-super-card__stat-label">Próximos</span>
          </div>
        )}
      </div>
      {propuesta.costoTotal.subtotal > 0 && (
        <p className="voy-al-super-card__estimado">
          Estimado: <strong>{formatMoneda(propuesta.costoTotal.subtotal, moneda)}{propuesta.costoTotal.completo ? '' : '+'}</strong>
        </p>
      )}
      <button className="btn btn--accent btn--sm" style={{ marginTop: 10 }} onClick={onVerPropuesta}>
        Ver propuesta
      </button>
    </div>
  );
}
