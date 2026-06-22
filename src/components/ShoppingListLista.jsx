import React from 'react';
import { useMemo, useState } from 'react';
import { debeComprarse, getStatus, getTotal, esProductoCritico, STATUS } from '../utils/stockLogic';

export default function ShoppingListLista({ productos, stockItems = [], manualItems, onConfirmarCompra, onAgregarManual, onToggleManual, onEliminarManual, onIniciarCompra }) {
  const [nuevoItem, setNuevoItem] = useState('');
  const [abiertoId, setAbiertoId] = useState(null);
  const [cantidadAAgregar, setCantidadAAgregar] = useState(1);

  // Orden de prioridad pedido: 1) críticos en "Comprar", 2) críticos "Por
  // agotarse", 3) normales "Comprar", 4) normales "Por agotarse". Reusa
  // esProductoCritico() (utils/stockLogic.js) — no se reimplementa el
  // criterio de criticidad acá.
  const prioridad = (p) => {
    const critico = esProductoCritico(p);
    const urgente = getStatus(p, stockItems) === STATUS.COMPRAR;
    if (critico && urgente) return 0;
    if (critico && !urgente) return 1;
    if (!critico && urgente) return 2;
    return 3;
  };

  const itemsAuto = useMemo(
    () => productos.filter((p) => debeComprarse(p, stockItems)).sort((a, b) => prioridad(a) - prioridad(b)),
    [productos, stockItems]
  );

  const manualesPendientes = manualItems.filter((m) => !m.comprado);
  const manualesComprados = manualItems.filter((m) => m.comprado);

  const abrirConfirmacion = (producto) => {
    if (abiertoId === producto.id) {
      setAbiertoId(null);
      return;
    }
    const sugerido = Math.max(1, producto.stockMinimo - getTotal(producto, stockItems)) || 1;
    setCantidadAAgregar(sugerido);
    setAbiertoId(producto.id);
  };

  const confirmar = (producto) => {
    onConfirmarCompra(producto.id, Number(cantidadAAgregar) || 0);
    setAbiertoId(null);
  };

  const handleAgregarManual = () => {
    if (!nuevoItem.trim()) return;
    onAgregarManual(nuevoItem.trim());
    setNuevoItem('');
  };

  const totalPendientes = itemsAuto.length + manualesPendientes.length;

  return (
    <div>
      <p className="section-title" style={{ marginTop: 4 }}>
        Lista de compras
        <span className="section-title__hint">{totalPendientes} pendientes</span>
      </p>

      {totalPendientes > 0 && (
        <button className="btn btn--accent" style={{ marginBottom: 14 }} onClick={onIniciarCompra}>
          🛒 Iniciar compra activa
        </button>
      )}

      <div className="add-manual-row">
        <input
          type="text"
          placeholder="Agregar item manual (ej: velas)"
          value={nuevoItem}
          onChange={(e) => setNuevoItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAgregarManual()}
        />
        <button onClick={handleAgregarManual} aria-label="Agregar item">+</button>
      </div>

      {totalPendientes === 0 && manualesComprados.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">🛍️</span>
          <p className="empty-state__title">Lista vacía</p>
          <p className="empty-state__text">Cuando un producto baje del mínimo va a aparecer acá solo.</p>
        </div>
      ) : (
        <>
          {itemsAuto.map((p) => {
            const status = getStatus(p, stockItems);
            const critico = esProductoCritico(p);
            return (
              <div key={p.id}>
                <div className="shop-item">
                  <button
                    className="shop-item__check"
                    onClick={() => abrirConfirmacion(p)}
                    aria-label="Marcar como comprado"
                  >
                    {abiertoId === p.id ? '✓' : ''}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div className="shop-item__name">{critico && '⭐ '}{p.nombre}</div>
                    <div className="shop-item__sub">
                      {p.categoria} · quedan {getTotal(p, stockItems)} {p.unidad} (mín. {p.stockMinimo})
                    </div>
                  </div>
                  <span className={`shop-item__tag ${status === STATUS.COMPRAR ? '' : ''}`}>
                    {status === STATUS.COMPRAR ? 'Urgente' : 'Por agotarse'}
                  </span>
                </div>
                {abiertoId === p.id && (
                  <div className="confirm-buy">
                    <p>¿Cuánto sumaste a la despensa de <strong>{p.nombre}</strong>?</p>
                    <div className="field-row">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={cantidadAAgregar}
                        onChange={(e) => setCantidadAAgregar(e.target.value)}
                        style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}
                      />
                      <button className="btn btn--primary btn--sm" onClick={() => confirmar(p)}>
                        Sumar a despensa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {manualesPendientes.map((item) => (
            <div className="shop-item" key={item.id}>
              <button
                className="shop-item__check"
                onClick={() => onToggleManual(item.id)}
                aria-label="Marcar como comprado"
              />
              <div style={{ flex: 1 }}>
                <div className="shop-item__name">{item.nombre}</div>
                <div className="shop-item__sub">Cantidad: {item.cantidad}</div>
              </div>
              <span className="shop-item__tag shop-item__tag--manual">Manual</span>
              <button className="shop-item__remove" onClick={() => onEliminarManual(item.id)} aria-label="Quitar">✕</button>
            </div>
          ))}

          {manualesComprados.length > 0 && (
            <>
              <p className="section-title">Ya comprados</p>
              {manualesComprados.map((item) => (
                <div className="shop-item is-checked" key={item.id}>
                  <button
                    className="shop-item__check is-checked"
                    onClick={() => onToggleManual(item.id)}
                    aria-label="Desmarcar"
                  >
                    ✓
                  </button>
                  <div style={{ flex: 1 }}>
                    <div className="shop-item__name">{item.nombre}</div>
                  </div>
                  <button className="shop-item__remove" onClick={() => onEliminarManual(item.id)} aria-label="Quitar">✕</button>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
