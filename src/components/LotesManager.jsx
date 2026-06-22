import React from 'react';
import { useState } from 'react';
import { lotesDeProducto } from '../utils/stockLogic';
import { ordenarFEFO, estaVencido, estaProximoAVencer, formatFechaCorta } from '../utils/lotes';
import { numeroPositivo } from '../utils/numeros';

function FilaLote({ lote, onEditar, onEliminar, onMover, onConsumir }) {
  const [editando, setEditando] = useState(false);
  const [cantidad, setCantidad] = useState(lote.cantidad);
  const [vencimiento, setVencimiento] = useState(lote.fechaVencimiento ? lote.fechaVencimiento.slice(0, 10) : '');
  const [observaciones, setObservaciones] = useState(lote.observaciones || '');

  const vencido = lote.fechaVencimiento && estaVencido(lote.fechaVencimiento);
  const porVencer = lote.fechaVencimiento && !vencido && estaProximoAVencer(lote.fechaVencimiento);

  const guardar = () => {
    onEditar(lote.id, {
      cantidad: numeroPositivo(cantidad),
      fechaVencimiento: vencimiento ? new Date(vencimiento).toISOString() : null,
      observaciones: observaciones.trim() || null
    });
    setEditando(false);
  };

  const eliminar = () => {
    if (window.confirm('¿Eliminar este lote? Esta acción no se puede deshacer.')) {
      onEliminar(lote.id);
    }
  };

  if (editando) {
    return (
      <div className="lote-row lote-row--editando">
        <div className="field-row" style={{ marginBottom: 8 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Cantidad</label>
            <input type="number" min="0" step="any" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Vencimiento</label>
            <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Observaciones</label>
          <input type="text" placeholder="Opcional" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
        <div className="btn-row">
          <button className="btn btn--ghost btn--sm" onClick={() => setEditando(false)}>Cancelar</button>
          <button className="btn btn--primary btn--sm" onClick={guardar}>Guardar lote</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lote-row">
      <div className="lote-row__info">
        <span className="lote-row__cantidad">{lote.cantidad} {lote.observaciones ? `· ${lote.observaciones}` : ''}</span>
        {lote.fechaVencimiento ? (
          <span className={`lote-row__venc ${vencido ? 'lote-row__venc--danger' : porVencer ? 'lote-row__venc--warn' : ''}`}>
            {vencido ? '⚠️ Venció' : '⏳ Vence'} {formatFechaCorta(lote.fechaVencimiento)}
          </span>
        ) : (
          <span className="lote-row__venc lote-row__venc--muted">Sin vencimiento</span>
        )}
      </div>
      <div className="lote-row__actions">
        {onConsumir && (
          <button className="stepper-btn" onClick={() => onConsumir(lote.id)} aria-label="Consumir 1" title="Consumir 1">−</button>
        )}
        {onMover && (
          <button className="text-btn" onClick={() => onMover(lote.id)} title="Mover a en uso">→ en uso</button>
        )}
        <button className="text-btn" onClick={() => setEditando(true)}>Editar</button>
        <button className="shop-item__remove" onClick={eliminar} aria-label="Eliminar lote">✕</button>
      </div>
    </div>
  );
}

function FormularioNuevoLote({ ubicacion, requiereVencimiento, onAgregar, onCancelar }) {
  const [cantidad, setCantidad] = useState(1);
  const [vencimiento, setVencimiento] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const agregar = () => {
    const cantidadFinal = numeroPositivo(cantidad);
    if (cantidadFinal <= 0) return;
    onAgregar({
      ubicacion,
      cantidad: cantidadFinal,
      fechaVencimiento: vencimiento ? new Date(vencimiento).toISOString() : null,
      observaciones: observaciones.trim() || null
    });
    setCantidad(1);
    setVencimiento('');
    setObservaciones('');
    onCancelar();
  };

  return (
    <div className="lote-row lote-row--editando">
      <div className="field-row" style={{ marginBottom: 8 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Cantidad</label>
          <input type="number" min="0" step="any" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Vencimiento {requiereVencimiento ? '(sugerido)' : '(opcional)'}</label>
          <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Observaciones</label>
        <input type="text" placeholder="Opcional" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </div>
      <div className="btn-row">
        <button className="btn btn--ghost btn--sm" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn--primary btn--sm" onClick={agregar}>Agregar lote</button>
      </div>
    </div>
  );
}

function Subseccion({ titulo, ubicacion, lotes, requiereVencimiento, onAgregarLote, onEditarLote, onEliminarLote, onMoverLote, onConsumirLote }) {
  const [agregando, setAgregando] = useState(false);
  const ordenados = ordenarFEFO(lotes);

  return (
    <div style={{ marginBottom: 14 }}>
      <p className="lote-subtitulo">{titulo}</p>
      {ordenados.length === 0 && !agregando && (
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '4px 0 8px' }}>Sin lotes acá.</p>
      )}
      {ordenados.map((lote) => (
        <FilaLote
          key={lote.id}
          lote={lote}
          onEditar={onEditarLote}
          onEliminar={onEliminarLote}
          onMover={ubicacion === 'despensa' ? onMoverLote : null}
          onConsumir={onConsumirLote}
        />
      ))}
      {agregando ? (
        <FormularioNuevoLote
          ubicacion={ubicacion}
          requiereVencimiento={requiereVencimiento}
          onAgregar={onAgregarLote}
          onCancelar={() => setAgregando(false)}
        />
      ) : (
        <button className="text-btn" onClick={() => setAgregando(true)}>+ Agregar lote en {titulo.toLowerCase()}</button>
      )}
    </div>
  );
}

export default function LotesManager({ producto, stockItems, onAgregarLote, onEditarLote, onEliminarLote, onMoverLote, onConsumirLote }) {
  const lotes = lotesDeProducto(stockItems, producto.id);
  const enUso = lotes.filter((l) => l.ubicacion === 'en_uso');
  const enDespensa = lotes.filter((l) => l.ubicacion === 'despensa');

  return (
    <div>
      <p className="section-title" style={{ marginTop: 0 }}>Lotes</p>
      <Subseccion
        titulo="En uso"
        ubicacion="en_uso"
        lotes={enUso}
        requiereVencimiento={producto.requiereVencimiento}
        onAgregarLote={(datos) => onAgregarLote(producto.id, datos)}
        onEditarLote={onEditarLote}
        onEliminarLote={onEliminarLote}
        onMoverLote={null}
        onConsumirLote={onConsumirLote}
      />
      <Subseccion
        titulo="Despensa"
        ubicacion="despensa"
        lotes={enDespensa}
        requiereVencimiento={producto.requiereVencimiento}
        onAgregarLote={(datos) => onAgregarLote(producto.id, datos)}
        onEditarLote={onEditarLote}
        onEliminarLote={onEliminarLote}
        onMoverLote={onMoverLote}
        onConsumirLote={onConsumirLote}
      />
    </div>
  );
}
