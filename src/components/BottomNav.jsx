import React from 'react';
const TABS = [
  { id: 'dashboard', label: 'Inicio', icon: '🏠' },
  { id: 'stock', label: 'Stock', icon: '📦' },
  { id: 'compras', label: 'Compras', icon: '🛒' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' }
];

export default function BottomNav({ active, onChange, comprasCount }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav__item ${active === tab.id ? 'is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.id === 'compras' && comprasCount > 0 && (
            <span className="bottom-nav__badge">{comprasCount}</span>
          )}
          <span className="bottom-nav__icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
