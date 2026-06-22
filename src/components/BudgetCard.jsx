import React from 'react';
import { getGastoMes, formatMoneda } from '../utils/historial';

export default function BudgetCard({ preferencias, historialCompras, onIrAjustes }) {
  const presupuesto = Number(preferencias?.presupuestoMensual || 0);
  const moneda = preferencias?.moneda || 'UYU';
  const gastado = getGastoMes(historialCompras);

  if (!presupuesto) {
    return (
      <div className="budget-card">
        <p className="budget-card__title">Presupuesto mensual</p>
        <p className="budget-card__empty">
          Todavía no configuraste un presupuesto. Definilo en Ajustes para ver cuánto vas gastando del mes.
        </p>
        <button className="btn btn--ghost btn--sm" onClick={onIrAjustes}>Configurar presupuesto</button>
      </div>
    );
  }

  const disponible = presupuesto - gastado;
  const pct = Math.min(100, Math.round((gastado / presupuesto) * 100));
  const barClass = pct >= 100 ? 'is-over' : pct >= 80 ? 'is-warn' : '';

  return (
    <div className="budget-card">
      <div className="budget-card__top">
        <span className="budget-card__title">Presupuesto del mes</span>
        <span className="budget-card__pct">{pct}%</span>
      </div>
      <div className="budget-card__bar-track">
        <div className={`budget-card__bar-fill ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="budget-card__row">
        <span>Gastado: <strong>{formatMoneda(gastado, moneda)}</strong></span>
        <span>Presupuesto: <strong>{formatMoneda(presupuesto, moneda)}</strong></span>
      </div>
      <div className="budget-card__row">
        <span>Disponible</span>
        <strong style={{ color: disponible < 0 ? 'var(--danger)' : 'var(--ink)' }}>
          {formatMoneda(disponible, moneda)}
        </strong>
      </div>
    </div>
  );
}
