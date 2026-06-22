import React from 'react';
import Modal from './Modal';

export default function TranquilidadDetalle({ resultado, onClose }) {
  const { puntaje, estado, factores, positivos } = resultado;

  return (
    <Modal title="🏠 Tranquilidad del hogar" onClose={onClose}>
      {puntaje === null ? (
        <div className="empty-state">
          <span className="empty-state__icon">🏠</span>
          <p className="empty-state__title">Todavía no hay datos suficientes</p>
          <p className="empty-state__text">
            Agregá productos a tu despensa para que la app pueda calcular tu índice de
            tranquilidad.
          </p>
        </div>
      ) : (
        <>
          <div className={`tranquilidad-detalle__hero tranquilidad-detalle__hero--${estado.color}`}>
            <span className="tranquilidad-detalle__puntaje">{puntaje}%</span>
            <span className="tranquilidad-detalle__estado">{estado.label}</span>
          </div>

          <p className="tranquilidad-detalle__pregunta">¿Qué tan abastecido está mi hogar hoy?</p>

          {positivos.length > 0 && (
            <>
              <p className="section-title" style={{ marginTop: 14 }}>Lo que está bien</p>
              <div className="mini-list">
                {positivos.map((linea) => (
                  <div className="mini-list__item" key={linea}>
                    <div className="mini-list__name">✅ {linea}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {factores.length > 0 ? (
            <>
              <p className="section-title">Qué está bajando tu tranquilidad</p>
              <div className="mini-list">
                {[...factores]
                  .sort((a, b) => b.penalizacion - a.penalizacion)
                  .map((f) => (
                    <div className="mini-list__item" key={f.tipo}>
                      <div>
                        <div className="mini-list__name">
                          {f.critico && '⭐ '}{f.cantidad} {f.etiqueta}
                        </div>
                        <div className="mini-list__sub">
                          {f.critico ? 'Producto crítico · ' : ''}-{f.penalizacion} puntos
                        </div>
                      </div>
                      <span className={`status-pill ${f.critico ? 'status-pill--danger' : 'status-pill--warn'}`}>
                        -{f.penalizacion}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-state__icon">🎉</span>
              <p className="empty-state__title">Nada está bajando tu tranquilidad</p>
              <p className="empty-state__text">Tu hogar está completamente al día.</p>
            </div>
          )}

          <p className="tranquilidad-detalle__nota">
            El índice se calcula sumando 100 puntos menos una penalización fija por cada situación
            encontrada (stock, vencimientos y predicción de consumo). Los productos críticos pesan
            más que los normales. No usa inteligencia artificial ni fórmulas ocultas — siempre se
            puede explicar con la lista de arriba.
          </p>
        </>
      )}
    </Modal>
  );
}
