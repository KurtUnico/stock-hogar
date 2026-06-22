import React from 'react';
import StatusBadge from './StatusBadge';
import { getStatus, getStockProducto, getNivelPorcentaje, lotesDeProducto, formatFecha, esProductoCritico, STATUS } from '../utils/stockLogic';
import { getHistorialProducto, formatMoneda, formatFechaHora } from '../utils/historial';
import { proximoVencimiento, estaVencido, estaProximoAVencer, formatFechaCorta } from '../utils/lotes';

const TAB_CLASS = {
  [STATUS.OK]: 'product-card__tab--ok',
  [STATUS.POR_AGOTARSE]: 'product-card__tab--warn',
  [STATUS.COMPRAR]: 'product-card__tab--danger'
};

const BAR_COLOR = {
  [STATUS.OK]: 'var(--ok)',
  [STATUS.POR_AGOTARSE]: 'var(--warn)',
  [STATUS.COMPRAR]: 'var(--danger)'
};

export default function ProductCard({ producto, stockItems = [], onAjustar, onEditar, historialCompras = [], moneda = 'UYU' }) {
  const status = getStatus(producto, stockItems);
  const { enUso: cantidadUso, enDespensa: cantidadDespensa, total } = getStockProducto(producto, stockItems);
  const nivel = getNivelPorcentaje(producto, stockItems);
  const historialPrecio = getHistorialProducto(producto.id, historialCompras);

  const lotes = lotesDeProducto(stockItems, producto.id);
  const vencimiento = proximoVencimiento(lotes);
  const vencido = vencimiento && estaVencido(vencimiento);
  const porVencer = vencimiento && !vencido && estaProximoAVencer(vencimiento);
  const critico = esProductoCritico(producto);

  // Defensivo: si el dato viene incompleto/corrupto (ej. localStorage editado
  // a mano, o una migración futura que se olvida un campo), mostramos un
  // valor razonable en vez de "undefined" o romper la tarjeta.
  const nombre = producto.nombre || 'Producto sin nombre';
  const categoria = producto.categoria || 'Sin categoría';
  const unidad = producto.unidad || 'unidad';
  const stockMinimo = Number.isFinite(producto.stockMinimo) ? producto.stockMinimo : 0;

  return (
    <div className="product-card">
      <div className={`product-card__tab ${TAB_CLASS[status]}`} />
      <div className="product-card__body">
        <div className="product-card__top">
          <div className="product-card__name-wrap">
            <p className="product-card__name">{critico && <span title="Producto crítico">⭐ </span>}{nombre}</p>
            <p className="product-card__cat">{categoria}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {critico && (
                <span className="price-badge price-badge--critico">⭐ Crítico</span>
              )}
              {historialPrecio && (
                <span className="price-badge" title={`Última compra: ${formatFechaHora(historialPrecio.fechaUltimoPrecio)}`}>
                  💲 {formatMoneda(historialPrecio.ultimoPrecio, moneda)}
                </span>
              )}
              {vencimiento && (
                <span className={`price-badge ${vencido ? 'price-badge--danger' : porVencer ? 'price-badge--warn' : ''}`}>
                  {vencido ? '⚠️ Vencido' : '⏳'} {formatFechaCorta(vencimiento)}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="product-card__bar-track">
          <div
            className="product-card__bar-fill"
            style={{ width: `${nivel}%`, background: BAR_COLOR[status] }}
          />
        </div>

        <div className="product-card__rows">
          <div className="qty-row">
            <span className="qty-row__label">En uso ({unidad})</span>
            <div className="qty-row__controls">
              <button
                className="stepper-btn"
                disabled={cantidadUso <= 0}
                onClick={() => onAjustar(producto.id, 'en_uso', -1)}
                aria-label="Restar uno a en uso"
              >
                −
              </button>
              <span className="qty-row__value">{cantidadUso}</span>
              <button
                className="stepper-btn"
                onClick={() => onAjustar(producto.id, 'en_uso', 1)}
                aria-label="Sumar uno a en uso"
              >
                +
              </button>
            </div>
          </div>

          <div className="qty-row">
            <span className="qty-row__label">En despensa ({unidad})</span>
            <div className="qty-row__controls">
              <button
                className="stepper-btn"
                disabled={cantidadDespensa <= 0}
                onClick={() => onAjustar(producto.id, 'despensa', -1)}
                aria-label="Restar uno a en despensa"
              >
                −
              </button>
              <span className="qty-row__value">{cantidadDespensa}</span>
              <button
                className="stepper-btn"
                onClick={() => onAjustar(producto.id, 'despensa', 1)}
                aria-label="Sumar uno a en despensa"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="product-card__footer">
          <span className="product-card__meta">
            Total {total} · mín. {stockMinimo} · act. {formatFecha(producto.ultimaActualizacion)}
          </span>
          <button className="text-btn" onClick={() => onEditar(producto)}>Editar</button>
        </div>
      </div>
    </div>
  );
}
