import React from 'react';
import { useMemo, useState } from 'react';
import ProductCard from './ProductCard';
import { getStatus, STATUS } from '../utils/stockLogic';

const ESTADOS = [
  { id: 'todos', label: 'Todos' },
  { id: STATUS.OK, label: 'OK' },
  { id: STATUS.POR_AGOTARSE, label: 'Por agotarse' },
  { id: STATUS.COMPRAR, label: 'Comprar' }
];

export default function StockList({ productos, stockItems = [], categorias, onAjustar, onEditar, onNuevo, historialCompras = [], moneda = 'UYU' }) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [estado, setEstado] = useState('todos');

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideTexto = (p.nombre || '').toLowerCase().includes(busqueda.trim().toLowerCase());
      const coincideCategoria = categoria === 'Todas' || p.categoria === categoria;
      const coincideEstado = estado === 'todos' || getStatus(p, stockItems) === estado;
      return coincideTexto && coincideCategoria && coincideEstado;
    });
  }, [productos, stockItems, busqueda, categoria, estado]);

  return (
    <div>
      <div className="search-bar">
        <span>🔍</span>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="chip-row">
        <button
          className={`chip ${categoria === 'Todas' ? 'is-active' : ''}`}
          onClick={() => setCategoria('Todas')}
        >
          Todas
        </button>
        {categorias.map((cat) => (
          <button
            key={cat}
            className={`chip ${categoria === cat ? 'is-active' : ''}`}
            onClick={() => setCategoria(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="chip-row">
        {ESTADOS.map((e) => (
          <button
            key={e.id}
            className={`chip ${estado === e.id ? 'is-active' : ''} ${
              e.id === STATUS.POR_AGOTARSE ? 'chip--warn' : e.id === STATUS.COMPRAR ? 'chip--danger' : ''
            }`}
            onClick={() => setEstado(e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {filtrados.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">📭</span>
            {productos.length === 0 ? (
              <>
                <p className="empty-state__title">Todavía no agregaste productos</p>
                <p className="empty-state__text">Tocá el botón + para cargar el primero.</p>
              </>
            ) : (
              <>
                <p className="empty-state__title">Ningún producto coincide</p>
                <p className="empty-state__text">Probá cambiar la búsqueda o los filtros.</p>
              </>
            )}
          </div>
        ) : (
          filtrados.map((p) => (
            <ProductCard
              key={p.id}
              producto={p}
              stockItems={stockItems}
              onAjustar={onAjustar}
              onEditar={onEditar}
              historialCompras={historialCompras}
              moneda={moneda}
            />
          ))
        )}
      </div>

      <button className="fab" onClick={onNuevo} aria-label="Agregar producto">+</button>
    </div>
  );
}
