import React from 'react';
import { formatMoneda } from '../utils/historial';

export default function VencimientosCard({ riesgo, moneda = 'UYU', onVerDetalles }) {
  const sinNovedades = riesgo.productosVencidos === 0 && riesgo.productosProximos === 0;

  return (
    <div className="venc-card">
      <div className="venc-card__top">
        <span className="venc-card__title">Vencimientos</span>
      </div>

      {sinNovedades ? (
        <p className="venc-card__empty">Ningún producto vencido ni por vencer. 🎉</p>
      ) : (
        <>
          <div className="venc-card__stats">
            <div className="venc-card__stat venc-card__stat--danger">
              <span className="venc-card__stat-value">{riesgo.productosVencidos}</span>
              <span className="venc-card__stat-label">Vencidos</span>
            </div>
            <div className="venc-card__stat venc-card__stat--warn">
              <span className="venc-card__stat-value">{riesgo.productosProximos}</span>
              <span className="venc-card__stat-label">Por vencer</span>
            </div>
          </div>
          <p className="venc-card__riesgo">
            Riesgo de desperdicio:{' '}
            <strong>
              {riesgo.tieneValorEconomico
                ? `${formatMoneda(riesgo.valorEconomico, moneda)}${riesgo.valorEconomicoCompleto ? '' : ' (parcial, falta precio en algunos lotes)'}`
                : `${riesgo.unidadesTotales} unidad${riesgo.unidadesTotales === 1 ? '' : 'es'} por vencer`}
            </strong>
          </p>
        </>
      )}

      <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={onVerDetalles}>
        Ver detalles
      </button>
    </div>
  );
}
