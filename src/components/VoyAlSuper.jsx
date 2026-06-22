import React, { useMemo, useState } from 'react';
import { generarPropuestaCompra, calcularImpactoPresupuesto, SECCION_META } from '../utils/voyAlSuper';
import { getGastoMes, formatMoneda } from '../utils/historial';

function SeccionPropuesta({ seccionId, items, costo, moneda }) {
  const meta = SECCION_META[seccionId];
  if (items.length === 0) return null;

  return (
    <>
      <p className="section-title" style={{ marginTop: 16 }}>
        {meta.icono} {meta.label}
        <span className="section-title__hint">
          {costo.subtotal > 0
            ? `${formatMoneda(costo.subtotal, moneda)}${costo.completo ? '' : '+'}`
            : ''}
        </span>
      </p>
      <div className="mini-list">
        {items.map((item) => (
          <div className="mini-list__item" key={item.producto.id}>
            <div>
              <div className="mini-list__name">{item.critico && '⭐ '}{item.producto.nombre}</div>
              <div className="mini-list__sub">{item.motivo}</div>
            </div>
            <div className="mini-list__sub" style={{ textAlign: 'right' }}>
              {item.tienePrecio ? (
                <>
                  {formatMoneda(item.subtotalEstimado, moneda)}
                  <br />
                  <span style={{ fontSize: 10.5 }}>{item.cantidadSugerida} {item.producto.unidad}</span>
                </>
              ) : (
                <span style={{ fontSize: 10.5 }}>{item.cantidadSugerida} {item.producto.unidad} · sin precio</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function VoyAlSuper({ productos, stockItems, eventos, historialCompras, preferencias, onCrearCompraActiva, onCompraCreada, onCerrar, compraActivaEnCurso }) {
  const [creando, setCreando] = useState(false);

  const moneda = preferencias?.moneda || 'UYU';
  const presupuesto = Number(preferencias?.presupuestoMensual || 0);

  const propuesta = useMemo(
    () =>
      generarPropuestaCompra(productos, stockItems, eventos, historialCompras, {
        incluirPrediccion: preferencias?.voyAlSuperIncluyePrediccion ?? true,
        incluirVencimientos: preferencias?.voyAlSuperIncluyeVencimientos ?? true,
        incluirCriticos: preferencias?.voyAlSuperIncluyeCriticos ?? true,
        diasParaCompraProxima: preferencias?.diasParaCompraProxima || 14,
        umbralDiasVencimiento: preferencias?.diasProximoVencimiento
      }),
    [productos, stockItems, eventos, historialCompras, preferencias]
  );

  const gastadoMes = useMemo(() => getGastoMes(historialCompras), [historialCompras]);
  const impacto = calcularImpactoPresupuesto(propuesta.costoTotal.subtotal, gastadoMes, presupuesto);

  const handleCrearCompraActiva = () => {
    setCreando(true);
    const itemsParaCompra = [...propuesta.urgentes, ...propuesta.recomendados];
    const ok = onCrearCompraActiva(itemsParaCompra);
    setCreando(false);
    if (ok) onCompraCreada();
  };

  return (
    <div>
      <div className="voy-al-super__hero">
        <span className="voy-al-super__hero-icon">🛒</span>
        <p className="voy-al-super__hero-title">Voy al súper</p>
        <p className="voy-al-super__hero-sub">
          Propuesta generada con tu stock, productos críticos, vencimientos y consumo habitual.
        </p>
      </div>

      {propuesta.vacia ? (
        <div className="empty-state">
          <span className="empty-state__icon">🎉</span>
          <p className="empty-state__title">No hace falta ir al súper todavía</p>
          <p className="empty-state__text">
            No encontramos productos urgentes, recomendados ni próximos a necesitar reposición.
          </p>
        </div>
      ) : (
        <>
          <SeccionPropuesta seccionId="urgente" items={propuesta.urgentes} costo={propuesta.costoUrgente} moneda={moneda} />
          <SeccionPropuesta seccionId="recomendado" items={propuesta.recomendados} costo={propuesta.costoRecomendado} moneda={moneda} />
          <SeccionPropuesta seccionId="proximo" items={propuesta.proximos} costo={propuesta.costoProximo} moneda={moneda} />

          <div className="voy-al-super__resumen">
            <div className="voy-al-super__resumen-row">
              <span>Compra urgente</span>
              <strong>{formatMoneda(propuesta.costoUrgente.subtotal, moneda)}</strong>
            </div>
            <div className="voy-al-super__resumen-row">
              <span>Compra recomendada</span>
              <strong>{formatMoneda(propuesta.costoRecomendado.subtotal, moneda)}</strong>
            </div>
            <div className="voy-al-super__resumen-row voy-al-super__resumen-row--total">
              <span>Compra total sugerida</span>
              <strong>{formatMoneda(propuesta.costoTotal.subtotal, moneda)}</strong>
            </div>
            {!propuesta.costoTotal.completo && propuesta.costoTotal.cantidadSinPrecio > 0 && (
              <p className="voy-al-super__nota-precio">
                {propuesta.costoTotal.cantidadSinPrecio} producto{propuesta.costoTotal.cantidadSinPrecio === 1 ? '' : 's'} sin
                precio cargado todavía — el total es parcial.
              </p>
            )}
          </div>

          {presupuesto > 0 ? (
            <div className={`voy-al-super__presupuesto ${impacto.superaPresupuesto ? 'is-warn' : ''}`}>
              <div className="voy-al-super__resumen-row">
                <span>Presupuesto disponible</span>
                <strong>{formatMoneda(impacto.disponible, moneda)}</strong>
              </div>
              <div className="voy-al-super__resumen-row">
                <span>Compra estimada</span>
                <strong>{formatMoneda(propuesta.costoTotal.subtotal, moneda)}</strong>
              </div>
              {impacto.superaPresupuesto && (
                <p className="voy-al-super__nota-precio" style={{ color: 'var(--warn)' }}>
                  ⚠️ Con esta compra superarías tu presupuesto mensual.
                </p>
              )}
            </div>
          ) : (
            <p className="voy-al-super__sin-presupuesto">
              No configuraste un presupuesto mensual — activalo en Ajustes para ver el impacto de esta compra.
            </p>
          )}

          <div className="btn-row" style={{ marginTop: 18, marginBottom: 24 }}>
            <button className="btn btn--ghost" onClick={onCerrar}>Cerrar</button>
            <button
              className="btn btn--primary"
              disabled={creando || compraActivaEnCurso || (propuesta.urgentes.length === 0 && propuesta.recomendados.length === 0)}
              onClick={handleCrearCompraActiva}
            >
              🛒 Crear compra activa
            </button>
          </div>
          {compraActivaEnCurso && (
            <p className="voy-al-super__nota-precio" style={{ marginTop: -16 }}>
              Ya tenés una compra activa en curso. Cerrala o cancelala antes de crear una nueva desde acá.
            </p>
          )}
        </>
      )}
    </div>
  );
}
