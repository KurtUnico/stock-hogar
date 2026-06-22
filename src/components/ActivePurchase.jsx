import React from 'react';
import { useMemo, useState } from 'react';
import Modal from './Modal';
import { getHistorialProducto, formatMoneda, getGastoMes } from '../utils/historial';
import { DIAS_PROXIMO_A_VENCER } from '../utils/lotes';
import { notaVencimientoEnCompra } from '../utils/wasteIntelligence';

export default function ActivePurchase({
  compraActiva,
  preferencias,
  historialCompras,
  stockItems = [],
  onIniciar,
  onActualizarItem,
  onAgregarManual,
  onQuitarItem,
  onCancelar,
  onCerrar
}) {
  const [nuevoItem, setNuevoItem] = useState('');
  const [mostrarResumen, setMostrarResumen] = useState(false);

  const moneda = preferencias?.moneda || 'UYU';
  const presupuesto = Number(preferencias?.presupuestoMensual || 0);
  const umbralDias = preferencias?.diasProximoVencimiento || DIAS_PROXIMO_A_VENCER;

  const items = compraActiva?.items || [];
  const enCarrito = items.filter((i) => i.comprado);
  const totalActivo = enCarrito.reduce((s, i) => s + Number(i.subtotal || 0), 0);

  const gastadoMes = useMemo(() => getGastoMes(historialCompras), [historialCompras]);
  const impactoPresupuesto = presupuesto > 0 ? gastadoMes + totalActivo : null;
  const superaPresupuesto = presupuesto > 0 && impactoPresupuesto > presupuesto;

  if (!compraActiva) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">🛒</span>
        <p className="empty-state__title">Todavía no iniciaste una compra</p>
        <p className="empty-state__text">
          Cuando estés en el súper, iniciá la compra activa para cargar precios y ver el total en tiempo real.
        </p>
        <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={onIniciar}>
          🛒 Iniciar compra activa
        </button>
      </div>
    );
  }

  const cambiarCampo = (item, campo, valor) => {
    onActualizarItem(item.id, { [campo]: valor });
  };

  const handleCancelar = () => {
    const mensaje = enCarrito.length > 0
      ? `¿Cancelar la compra? Vas a perder ${enCarrito.length} producto${enCarrito.length > 1 ? 's' : ''} ya marcado${enCarrito.length > 1 ? 's' : ''} como comprado${enCarrito.length > 1 ? 's' : ''}.`
      : '¿Cancelar la compra activa?';
    if (window.confirm(mensaje)) {
      onCancelar();
    }
  };

  const handleAgregarManual = () => {
    if (!nuevoItem.trim()) return;
    onAgregarManual(nuevoItem.trim());
    setNuevoItem('');
  };

  const sinPrecio = enCarrito.filter((i) => !i.precioUnitario);
  const sinCantidad = enCarrito.filter((i) => !i.cantidad);
  const sinVencimiento = enCarrito.filter((i) => i.requiereVencimiento && !i.fechaVencimiento);

  return (
    <div>
      <div className="active-purchase-bar">
        <div className="active-purchase-bar__row">
          <span className="active-purchase-bar__label">Total de la compra ({enCarrito.length} en el carrito)</span>
          <span className="active-purchase-bar__total">{formatMoneda(totalActivo, moneda)}</span>
        </div>
        {presupuesto > 0 && (
          <div className={`active-purchase-bar__budget ${superaPresupuesto ? 'is-warn' : ''}`}>
            {superaPresupuesto
              ? `⚠️ Con esta compra superás tu presupuesto mensual (${formatMoneda(presupuesto, moneda)})`
              : `Llevás gastado este mes: ${formatMoneda(impactoPresupuesto, moneda)} de ${formatMoneda(presupuesto, moneda)}`}
          </div>
        )}
      </div>

      <div className="add-manual-row">
        <input
          type="text"
          placeholder="Agregar producto no previsto"
          value={nuevoItem}
          onChange={(e) => setNuevoItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAgregarManual()}
        />
        <button onClick={handleAgregarManual} aria-label="Agregar item">+</button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">🧾</span>
          <p className="empty-state__title">No hay ítems cargados</p>
          <p className="empty-state__text">Agregá productos manuales o cancelá la compra.</p>
        </div>
      ) : (
        items.map((item) => {
          const historialPrecio = item.productoId ? getHistorialProducto(item.productoId, historialCompras) : null;
          const notaVencimiento = notaVencimientoEnCompra(item.productoId, stockItems, umbralDias);
          const critico = Boolean(item.esCritico);
          return (
            <div className={`active-item ${item.comprado ? 'is-comprado' : ''} ${critico ? 'active-item--critico' : ''}`} key={item.id}>
              <div className="active-item__top">
                <button
                  className={`shop-item__check ${item.comprado ? 'is-checked' : ''}`}
                  onClick={() => onActualizarItem(item.id, { comprado: !item.comprado })}
                  aria-label={item.comprado ? 'Quitar del carrito' : 'Agregar al carrito'}
                >
                  {item.comprado ? '✓' : ''}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="active-item__name">{critico && '⭐ '}{item.nombre}</div>
                  <div className="active-item__cat">
                    {item.categoria || 'Manual'} · {item.origen === 'manual' ? 'no previsto' : 'sugerido'}
                  </div>
                </div>
                <button className="shop-item__remove" onClick={() => onQuitarItem(item.id)} aria-label="Quitar">✕</button>
              </div>

              {historialPrecio && (
                <div className="active-item__last-price">
                  Última vez pagaste {formatMoneda(historialPrecio.ultimoPrecio, moneda)} ({item.unidad})
                </div>
              )}

              {notaVencimiento && (
                <div className="active-item__nota-vencimiento">
                  📦 {notaVencimiento.mensaje}
                </div>
              )}

              <div className="active-item__fields">
                <div className="active-item__field">
                  <label>Cantidad</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={item.cantidad}
                    onChange={(e) => cambiarCampo(item, 'cantidad', e.target.value)}
                  />
                </div>
                <div className="active-item__field">
                  <label>Unidad</label>
                  <input type="text" value={item.unidad || ''} readOnly />
                </div>
                <div className="active-item__field">
                  <label>Precio unit.</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={item.precioUnitario}
                    onChange={(e) => cambiarCampo(item, 'precioUnitario', e.target.value)}
                  />
                </div>
              </div>
              {item.requiereVencimiento && (
                <div className="active-item__field" style={{ marginTop: 8 }}>
                  <label>Vencimiento (opcional, pero se recomienda para este producto)</label>
                  <input
                    type="date"
                    value={item.fechaVencimiento ? item.fechaVencimiento.slice(0, 10) : ''}
                    onChange={(e) => cambiarCampo(item, 'fechaVencimiento', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  />
                </div>
              )}
              <div className="active-item__subtotal">{formatMoneda(item.subtotal, moneda)}</div>
            </div>
          );
        })
      )}

      <div className="btn-row" style={{ marginTop: 16, marginBottom: 30 }}>
        <button className="btn btn--ghost" onClick={handleCancelar}>Cancelar compra</button>
        <button className="btn btn--primary" onClick={() => setMostrarResumen(true)}>Cerrar compra</button>
      </div>

      {mostrarResumen && (
        <Modal title="Confirmar compra" onClose={() => setMostrarResumen(false)}>
          <div className="summary-row">
            <span className="summary-row__label">Ítems en el carrito</span>
            <span className="summary-row__value">{enCarrito.length}</span>
          </div>
          <div className="summary-row">
            <span className="summary-row__label">Total a pagar</span>
            <span className="summary-row__value">{formatMoneda(totalActivo, moneda)}</span>
          </div>
          {sinPrecio.length > 0 && (
            <div className="summary-warning">
              ⚠️ {sinPrecio.length} producto{sinPrecio.length > 1 ? 's' : ''} sin precio cargado (se va a guardar
              como {formatMoneda(0, moneda)}): {sinPrecio.map((i) => i.nombre).join(', ')}
            </div>
          )}
          {sinCantidad.length > 0 && (
            <div className="summary-warning">
              ⚠️ {sinCantidad.length} producto{sinCantidad.length > 1 ? 's' : ''} con cantidad 0:{' '}
              {sinCantidad.map((i) => i.nombre).join(', ')}
            </div>
          )}
          {sinVencimiento.length > 0 && (
            <div className="summary-warning">
              📅 {sinVencimiento.length} producto{sinVencimiento.length > 1 ? 's' : ''} sin vencimiento cargado
              (se puede agregar después, desde el detalle del producto): {sinVencimiento.map((i) => i.nombre).join(', ')}
            </div>
          )}
          {superaPresupuesto && (
            <div className="summary-warning">⚠️ Esta compra supera tu presupuesto mensual.</div>
          )}
          {enCarrito.length === 0 && (
            <div className="summary-warning">No marcaste ningún producto como agregado al carrito todavía.</div>
          )}
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn--ghost" onClick={() => setMostrarResumen(false)}>Seguir comprando</button>
            <button
              className="btn btn--primary"
              disabled={enCarrito.length === 0}
              onClick={() => {
                setMostrarResumen(false);
                onCerrar();
              }}
            >
              Confirmar y cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
