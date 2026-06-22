import React from 'react';
import { useState } from 'react';
import { UNIDADES } from '../data/categories';
import { calcularPrediccion } from '../utils/predictions';
import { getHistorialProducto, formatMoneda, formatFechaHora } from '../utils/historial';
import { numeroPositivo } from '../utils/numeros';
import { lotesDeProducto, esProductoCritico } from '../utils/stockLogic';
import { estaVencido, estaProximoAVencer, diasParaVencer, ordenarFEFO, formatFechaCorta, DIAS_PROXIMO_A_VENCER } from '../utils/lotes';
import { complementarPrediccion } from '../utils/wasteIntelligence';
import PredictionCard from './PredictionCard';
import LotesManager from './LotesManager';

const PRODUCTO_VACIO = {
  nombre: '',
  categoria: '',
  unidad: 'unidad',
  stockMinimo: 1,
  notificacionActiva: true,
  requiereVencimiento: false,
  esCritico: false
};

export default function ProductForm({
  producto,
  categorias,
  stockItems = [],
  onGuardar,
  onEliminar,
  onAgregarCategoria,
  onAgregarLote,
  onEditarLote,
  onEliminarLote,
  onMoverLote,
  onConsumirLote,
  eventos = [],
  historialCompras = [],
  moneda = 'UYU',
  umbralDias = DIAS_PROXIMO_A_VENCER
}) {
  const [form, setForm] = useState(
    producto ? { ...producto } : { ...PRODUCTO_VACIO, categoria: categorias[0] || '' }
  );
  // Solo se usan al CREAR un producto nuevo: son la semilla de los lotes
  // iniciales, no campos del producto en sí (ver LotesManager para editar
  // lotes de un producto ya existente).
  const [cantidadUsoInicial, setCantidadUsoInicial] = useState(0);
  const [cantidadDespensaInicial, setCantidadDespensaInicial] = useState(0);
  const [vencimientoInicial, setVencimientoInicial] = useState('');

  const [mostrarNuevaCategoria, setMostrarNuevaCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [error, setError] = useState('');

  const prediccion = producto ? calcularPrediccion(producto, eventos, stockItems) : null;
  const historialPrecio = producto ? getHistorialProducto(producto.id, historialCompras) : null;

  // Estado de vencimientos de ESTE producto (para la sección de detalle).
  const lotesDelProducto = producto ? lotesDeProducto(stockItems, producto.id) : [];
  const lotesVencidos = lotesDelProducto.filter((l) => l.fechaVencimiento && estaVencido(l.fechaVencimiento));
  const lotesProximos = lotesDelProducto.filter((l) => l.fechaVencimiento && estaProximoAVencer(l.fechaVencimiento, umbralDias));
  const cantidadVencida = lotesVencidos.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const cantidadProxima = lotesProximos.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const loteMasUrgente = lotesDelProducto.filter((l) => l.fechaVencimiento && l.cantidad > 0).length > 0
    ? ordenarFEFO(lotesDelProducto.filter((l) => l.fechaVencimiento && l.cantidad > 0))[0]
    : null;
  const complemento = producto ? complementarPrediccion(producto, prediccion, stockItems, umbralDias) : null;

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const confirmarNuevaCategoria = () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    onAgregarCategoria(nombre);
    set('categoria', nombre);
    setNuevaCategoria('');
    setMostrarNuevaCategoria(false);
  };

  const handleGuardar = () => {
    const nombreLimpio = form.nombre.trim();
    if (!nombreLimpio) {
      setError('Ponele un nombre al producto.');
      return;
    }
    if (!form.categoria) {
      setError('Elegí una categoría.');
      return;
    }
    onGuardar({
      ...form,
      nombre: nombreLimpio,
      stockMinimo: numeroPositivo(form.stockMinimo),
      requiereVencimiento: Boolean(form.requiereVencimiento),
      esCritico: Boolean(form.esCritico),
      // Solo tienen efecto si esto es un producto NUEVO (App.jsx los usa
      // para crear los lotes iniciales y después los descarta).
      cantidadUsoInicial: numeroPositivo(cantidadUsoInicial),
      cantidadDespensaInicial: numeroPositivo(cantidadDespensaInicial),
      vencimientoInicial: vencimientoInicial ? new Date(vencimientoInicial).toISOString() : null
    });
  };

  const handleEliminarClick = () => {
    if (window.confirm(`¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer (también se borran sus lotes).`)) {
      onEliminar(producto.id);
    }
  };

  return (
    <div>
      <div className="field">
        <label>Nombre del producto</label>
        <input
          type="text"
          placeholder="Ej: Detergente"
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          autoFocus={!producto}
        />
      </div>

      <div className="field">
        <label>Categoría</label>
        {!mostrarNuevaCategoria ? (
          <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        ) : (
          <div className="category-add-row">
            <input
              type="text"
              placeholder="Nombre de la categoría"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              autoFocus
            />
            <button className="btn btn--primary btn--sm" onClick={confirmarNuevaCategoria}>Agregar</button>
          </div>
        )}
        <button
          className="text-btn"
          style={{ marginTop: 6 }}
          onClick={() => setMostrarNuevaCategoria((v) => !v)}
        >
          {mostrarNuevaCategoria ? '✕ Cancelar' : '+ Nueva categoría'}
        </button>
      </div>

      <div className="field">
        <label>Unidad de medida</label>
        <select value={form.unidad || 'unidad'} onChange={(e) => set('unidad', e.target.value)}>
          {UNIDADES.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Stock mínimo (total uso + despensa)</label>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={form.stockMinimo}
          onChange={(e) => set('stockMinimo', e.target.value)}
        />
      </div>

      <div className="toggle-row">
        <span>Este producto vence (lácteos, fiambres, medicamentos...)</span>
        <button
          className={`switch ${form.requiereVencimiento ? 'is-on' : ''}`}
          onClick={() => set('requiereVencimiento', !form.requiereVencimiento)}
          aria-label="Requiere vencimiento"
        >
          <span className="switch__knob" />
        </button>
      </div>

      <div className="toggle-row">
        <span>Avisarme cuando esté por agotarse</span>
        <button
          className={`switch ${form.notificacionActiva ? 'is-on' : ''}`}
          onClick={() => set('notificacionActiva', !form.notificacionActiva)}
          aria-label="Activar notificación"
        >
          <span className="switch__knob" />
        </button>
      </div>

      <div className="toggle-row toggle-row--critico">
        <div>
          <span>☑ Producto crítico</span>
          <p className="toggle-row__hint">
            Los productos críticos reciben prioridad en alertas, predicciones y futuras
            recomendaciones.
          </p>
        </div>
        <button
          className={`switch ${form.esCritico ? 'is-on' : ''}`}
          onClick={() => set('esCritico', !form.esCritico)}
          aria-label="Producto crítico"
        >
          <span className="switch__knob" />
        </button>
      </div>

      {!producto ? (
        <>
          <div className="field-row">
            <div className="field">
              <label>Cantidad inicial en uso</label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={cantidadUsoInicial}
                onChange={(e) => setCantidadUsoInicial(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Cantidad inicial en despensa</label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={cantidadDespensaInicial}
                onChange={(e) => setCantidadDespensaInicial(e.target.value)}
              />
            </div>
          </div>
          {form.requiereVencimiento && (
            <div className="field">
              <label>Vencimiento de esa cantidad inicial (opcional)</label>
              <input type="date" value={vencimientoInicial} onChange={(e) => setVencimientoInicial(e.target.value)} />
              <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>
                Si tenés lotes con vencimientos distintos, guardá el producto primero y agregalos desde
                "Lotes" en el detalle.
              </p>
            </div>
          )}
        </>
      ) : null}

      {producto && (lotesVencidos.length > 0 || lotesProximos.length > 0) && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <p className="section-title" style={{ marginTop: 0 }}>Estado de vencimientos</p>
          <div className="prediction-box">
            {lotesVencidos.length > 0 && (
              <p>
                ⚠️ {cantidadVencida} {producto.unidad} vencid{cantidadVencida === 1 ? 'a' : 'as'}
                {lotesVencidos.length > 1 ? ` (en ${lotesVencidos.length} lotes)` : ''}.
              </p>
            )}
            {lotesProximos.length > 0 && (
              <p className={lotesVencidos.length > 0 ? 'prediction-box__meta' : ''}>
                ⏳ {cantidadProxima} {producto.unidad} próxim{cantidadProxima === 1 ? 'a' : 'as'} a vencer (dentro de {umbralDias} días).
              </p>
            )}
            {loteMasUrgente && (
              <p className="prediction-box__meta">
                Recomendación: consumir primero el lote que {estaVencido(loteMasUrgente.fechaVencimiento) ? 'venció el' : 'vence el'}{' '}
                {formatFechaCorta(loteMasUrgente.fechaVencimiento)}.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: -6, marginBottom: 10 }}>{error}</p>
      )}

      <div className="btn-row">
        {producto && (
          <button className="btn btn--danger" onClick={handleEliminarClick}>Eliminar</button>
        )}
        <button className="btn btn--primary" onClick={handleGuardar}>
          {producto ? 'Guardar cambios' : 'Agregar producto'}
        </button>
      </div>

      {producto && (
        <div style={{ marginTop: 18 }}>
          <LotesManager
            producto={producto}
            stockItems={stockItems}
            onAgregarLote={onAgregarLote}
            onEditarLote={onEditarLote}
            onEliminarLote={onEliminarLote}
            onMoverLote={onMoverLote}
            onConsumirLote={onConsumirLote}
          />
        </div>
      )}

      {producto && (prediccion || historialPrecio) && (
        <div style={{ marginTop: 8 }}>
          <p className="section-title" style={{ marginTop: 0 }}>Más sobre este producto</p>
          <PredictionCard prediccion={prediccion} variant="box" critico={producto ? esProductoCritico(producto) : false} />
          {complemento && (
            <div className={`prediction-box ${complemento.tipo === 'riesgo' ? 'prediction-box--riesgo' : ''}`} style={{ marginTop: 8 }}>
              <p>
                {complemento.tipo === 'riesgo' ? '⚠️ ' : '✅ '}
                {producto && esProductoCritico(producto) && <strong>Producto crítico — </strong>}
                {complemento.mensaje}
              </p>
            </div>
          )}
          {historialPrecio && (
            <div className="field-static" style={{ marginTop: 10, lineHeight: 1.5 }}>
              💲 Último precio: <strong>{formatMoneda(historialPrecio.ultimoPrecio, moneda)}</strong>
              {' '}({formatFechaHora(historialPrecio.fechaUltimoPrecio)})
              <br />
              Promedio histórico: {formatMoneda(historialPrecio.precioPromedio, moneda)} ·{' '}
              {historialPrecio.cantidadCompras} compra{historialPrecio.cantidadCompras > 1 ? 's' : ''} registrada
              {historialPrecio.cantidadCompras > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
