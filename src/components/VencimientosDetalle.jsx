import React from 'react';
import Modal from './Modal';
import { formatFechaCorta } from '../utils/lotes';

export default function VencimientosDetalle({ vencidos, proximos, consumoRecomendado, recomendacionesCompra, onClose }) {
  const sinNada = vencidos.length === 0 && proximos.length === 0;

  return (
    <Modal title="Vencimientos" onClose={onClose}>
      {sinNada ? (
        <div className="empty-state">
          <span className="empty-state__icon">🎉</span>
          <p className="empty-state__title">Todo en orden</p>
          <p className="empty-state__text">Ningún producto vencido ni próximo a vencer por ahora.</p>
        </div>
      ) : (
        <>
          {vencidos.length > 0 && (
            <>
              <p className="section-title" style={{ marginTop: 0 }}>Vencidos</p>
              <div className="mini-list">
                {vencidos.map((v) => (
                  <div className="mini-list__item" key={v.producto.id}>
                    <div>
                      <div className="mini-list__name">{v.producto.esCritico && '⭐ '}⚠️ {v.producto.nombre}</div>
                      <div className="mini-list__sub">
                        {v.producto.esCritico && <strong style={{ color: 'var(--warn)' }}>Producto crítico · </strong>}
                        {v.cantidadTotal} {v.producto.unidad} · vencieron hace {Math.abs(v.dias)} día{Math.abs(v.dias) === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="status-pill status-pill--danger">{formatFechaCorta(v.lote.fechaVencimiento)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {proximos.length > 0 && (
            <>
              <p className="section-title">Próximos a vencer</p>
              <div className="mini-list">
                {proximos.map((v) => (
                  <div className="mini-list__item" key={v.producto.id}>
                    <div>
                      <div className="mini-list__name">{v.producto.esCritico && '⭐ '}⏳ {v.producto.nombre}</div>
                      <div className="mini-list__sub">
                        {v.producto.esCritico && <strong style={{ color: 'var(--warn)' }}>Producto crítico · </strong>}
                        {v.cantidadTotal} {v.producto.unidad} · vence {v.dias === 0 ? 'hoy' : `en ${v.dias} día${v.dias === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <span className="status-pill status-pill--warn">{formatFechaCorta(v.lote.fechaVencimiento)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {consumoRecomendado.length > 0 && (
            <>
              <p className="section-title">Consumir primero (orden FEFO)</p>
              <ol className="venc-orden-lista">
                {consumoRecomendado.map((c) => (
                  <li key={c.producto.id}>
                    {c.producto.nombre}
                    {c.dias !== null && (
                      <span className="venc-orden-lista__dato">
                        {' '}— {c.dias < 0 ? `venció hace ${Math.abs(c.dias)} día${Math.abs(c.dias) === 1 ? '' : 's'}` : `vence en ${c.dias} día${c.dias === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}

      {recomendacionesCompra.length > 0 && (
        <>
          <p className="section-title">Sugerencias</p>
          {recomendacionesCompra.map((r) => (
            <div className="dashboard-callout" key={r.producto.id} style={{ marginTop: 8 }}>
              <span className="dashboard-callout__icon">💡</span>
              <p className="dashboard-callout__text">
                <strong>{r.mensaje}</strong> {r.detalle}
              </p>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
