import React from 'react';
import Modal from '../Modal';

export default function MigratePrompt({ onMigrar, onDescartar, migrando, error }) {
  return (
    <Modal title="Encontramos datos en este dispositivo" onClose={migrando ? undefined : onDescartar}>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: -4, marginBottom: 16 }}>
        Tenés productos, compras o ajustes guardados en este celular/navegador, de antes de iniciar
        sesión. ¿Querés subirlos a tu cuenta para tenerlos disponibles en todos tus dispositivos?
      </p>
      {error && (
        <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12 }}>{error}</p>
      )}
      <div className="btn-row">
        <button className="btn btn--ghost" onClick={onDescartar} disabled={migrando}>
          Ahora no
        </button>
        <button className="btn btn--primary" onClick={onMigrar} disabled={migrando}>
          {migrando ? 'Subiendo datos...' : 'Subir mis datos'}
        </button>
      </div>
    </Modal>
  );
}
