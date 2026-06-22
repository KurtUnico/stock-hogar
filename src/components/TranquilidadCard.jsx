import React from 'react';

// Tarjeta resumida para el Dashboard. variant="card" en el resto de la app
// (PredictionCard, etc.) se usa para listas; acá es una tarjeta principal
// propia, como VencimientosCard, así que no reusa ese patrón de variant.
export default function TranquilidadCard({ resultado, onVerDetalles }) {
  const { puntaje, estado, explicacion } = resultado;

  if (puntaje === null) {
    return (
      <div className="tranquilidad-card">
        <div className="tranquilidad-card__top">
          <span className="tranquilidad-card__title">🏠 Tranquilidad</span>
        </div>
        <p className="tranquilidad-card__sin-datos">
          Agregá productos a tu despensa para calcular tu índice de tranquilidad.
        </p>
      </div>
    );
  }

  return (
    <button className={`tranquilidad-card tranquilidad-card--${estado.color}`} onClick={onVerDetalles}>
      <div className="tranquilidad-card__top">
        <span className="tranquilidad-card__title">🏠 Tranquilidad</span>
        <span className={`tranquilidad-card__estado tranquilidad-card__estado--${estado.color}`}>
          {estado.label}
        </span>
      </div>
      <div className="tranquilidad-card__puntaje-row">
        <span className="tranquilidad-card__puntaje">{puntaje}%</span>
        <div className="tranquilidad-card__bar-track">
          <div
            className={`tranquilidad-card__bar-fill tranquilidad-card__bar-fill--${estado.color}`}
            style={{ width: `${puntaje}%` }}
          />
        </div>
      </div>
      {explicacion.length > 0 ? (
        <ul className="tranquilidad-card__motivos">
          {explicacion.slice(0, 3).map((linea) => (
            <li key={linea}>{linea}</li>
          ))}
          {explicacion.length > 3 && <li className="tranquilidad-card__motivos-mas">+ otros factores · ver detalle</li>}
        </ul>
      ) : (
        <p className="tranquilidad-card__sin-datos">Sin novedades — todo bajo control. 🎉</p>
      )}
    </button>
  );
}
