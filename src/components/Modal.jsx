import React from 'react';
export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__handle" />
        {title && <h2 className="modal-sheet__title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
