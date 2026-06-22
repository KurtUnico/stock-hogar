import React from 'react';
import { useEffect, useState } from 'react';
import ShoppingListLista from './ShoppingListLista';
import ActivePurchase from './ActivePurchase';
import PurchaseHistory from './PurchaseHistory';
import VoyAlSuper from './VoyAlSuper';

const VISTAS = [
  { id: 'lista', label: 'Lista', icon: '📋' },
  { id: 'activa', label: 'Compra', icon: '🛒' },
  { id: 'super', label: 'Súper', icon: '🏃' },
  { id: 'historial', label: 'Historial', icon: '🧾' }
];

export default function ShoppingList({
  productos,
  stockItems = [],
  eventos,
  manualItems,
  onConfirmarCompra,
  onAgregarManual,
  onToggleManual,
  onEliminarManual,
  compraActiva,
  preferencias,
  historialCompras,
  onIniciarCompraActiva,
  onActualizarItemActivo,
  onAgregarManualActivo,
  onQuitarItemActivo,
  onCancelarCompraActiva,
  onCerrarCompraActiva,
  onCrearCompraActivaDesdePropuesta,
  vistaInicial
}) {
  const [vista, setVista] = useState(() => vistaInicial || (compraActiva ? 'activa' : 'lista'));

  // Si el padre pide explícitamente abrir "Voy al súper" (ej. desde el
  // botón del Dashboard), saltamos a esa vista — sin pisar la elección del
  // usuario si ya estaba navegando otra pestaña por su cuenta después.
  useEffect(() => {
    if (vistaInicial) setVista(vistaInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaInicial]);

  return (
    <div>
      <div className="segmented">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            className={`segmented__item ${vista === v.id ? 'is-active' : ''}`}
            onClick={() => setVista(v.id)}
          >
            <span>{v.icon}</span>
            <span>{v.label}</span>
            {v.id === 'activa' && compraActiva && <span> ●</span>}
          </button>
        ))}
      </div>

      {vista === 'lista' && (
        <ShoppingListLista
          productos={productos}
          stockItems={stockItems}
          manualItems={manualItems}
          onConfirmarCompra={onConfirmarCompra}
          onAgregarManual={onAgregarManual}
          onToggleManual={onToggleManual}
          onEliminarManual={onEliminarManual}
          onIniciarCompra={() => {
            onIniciarCompraActiva();
            setVista('activa');
          }}
        />
      )}

      {vista === 'activa' && (
        <ActivePurchase
          compraActiva={compraActiva}
          preferencias={preferencias}
          historialCompras={historialCompras}
          stockItems={stockItems}
          onIniciar={onIniciarCompraActiva}
          onActualizarItem={onActualizarItemActivo}
          onAgregarManual={onAgregarManualActivo}
          onQuitarItem={onQuitarItemActivo}
          onCancelar={() => {
            onCancelarCompraActiva();
            setVista('lista');
          }}
          onCerrar={() => {
            onCerrarCompraActiva();
            setVista('historial');
          }}
        />
      )}

      {vista === 'super' && (
        <VoyAlSuper
          productos={productos}
          stockItems={stockItems}
          eventos={eventos}
          historialCompras={historialCompras}
          preferencias={preferencias}
          compraActivaEnCurso={Boolean(compraActiva)}
          onCrearCompraActiva={(itemsPropuesta) => onCrearCompraActivaDesdePropuesta(itemsPropuesta)}
          // No dependemos de `compraActiva` acá: el prop todavía refleja el
          // valor del render anterior justo después de crearla (React no
          // actualiza el closure sincrónicamente). VoyAlSuper nos dice
          // explícitamente "se creó con éxito" y saltamos directo a la
          // pestaña de compra activa para que se vea de inmediato.
          onCompraCreada={() => setVista('activa')}
          onCerrar={() => setVista(compraActiva ? 'activa' : 'lista')}
        />
      )}

      {vista === 'historial' && (
        <PurchaseHistory historialCompras={historialCompras} moneda={preferencias?.moneda} />
      )}
    </div>
  );
}
