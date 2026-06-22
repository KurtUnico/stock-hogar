import React from 'react';
import { useState } from 'react';
import { formatMoneda, formatFechaHora } from '../utils/historial';

function HistoryCard({ compra, moneda }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="history-card" onClick={() => setAbierto((v) => !v)}>
      <div className="history-card__top">
        <div>
          <div className="history-card__date">{formatFechaHora(compra.fecha)}</div>
          <div className="history-card__count">{compra.items.length} producto{compra.items.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="history-card__total">{formatMoneda(compra.total, moneda)}</div>
      </div>
      {abierto && (
        <div className="history-card__details">
          {compra.items.map((item, idx) => (
            <div className="history-card__item-row" key={idx}>
              <span className="history-card__item-name">{item.nombre} × {item.cantidad} {item.unidad}</span>
              <span className="history-card__item-meta">{formatMoneda(item.subtotal, moneda)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PurchaseHistory({ historialCompras, moneda = 'UYU' }) {
  const ordenado = [...historialCompras].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (ordenado.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">🧾</span>
        <p className="empty-state__title">Todavía no hay compras cerradas</p>
        <p className="empty-state__text">Cuando cierres una compra activa, va a aparecer acá con el detalle de precios.</p>
      </div>
    );
  }

  return (
    <div>
      {ordenado.map((compra) => (
        <HistoryCard key={compra.id} compra={compra} moneda={moneda} />
      ))}
    </div>
  );
}
