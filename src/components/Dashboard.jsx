import React from 'react';
import { useMemo, useState } from 'react';
import { getResumen, getStatus, getTotal, obtenerResumenCriticos, esProductoCritico, STATUS } from '../utils/stockLogic';
import { calcularPrediccion } from '../utils/predictions';
import { DIAS_PROXIMO_A_VENCER } from '../utils/lotes';
import {
  productosVencidos,
  productosProximosAVencer,
  calcularRiesgoDesperdicio,
  ordenConsumoRecomendado,
  recomendacionesCompra
} from '../utils/wasteIntelligence';
import { calcularTranquilidad } from '../utils/tranquilidad';
import { generarPropuestaCompra } from '../utils/voyAlSuper';
import BudgetCard from './BudgetCard';
import PredictionCard from './PredictionCard';
import VencimientosCard from './VencimientosCard';
import VencimientosDetalle from './VencimientosDetalle';
import TranquilidadCard from './TranquilidadCard';
import TranquilidadDetalle from './TranquilidadDetalle';
import VoyAlSuperCard from './VoyAlSuperCard';

export default function Dashboard({ productos, stockItems = [], eventos, historialCompras, preferencias, onVerCompras, onVerStock, onIrAjustes, onVerVoyAlSuper }) {
  const [mostrarDetalleVencimientos, setMostrarDetalleVencimientos] = useState(false);
  const [mostrarDetalleTranquilidad, setMostrarDetalleTranquilidad] = useState(false);
  const umbralDias = preferencias?.diasProximoVencimiento || DIAS_PROXIMO_A_VENCER;
  const mostrarTranquilidad = preferencias?.mostrarTranquilidadDashboard ?? true;

  const resumen = getResumen(productos, stockItems);
  const resumenCriticos = obtenerResumenCriticos(productos, stockItems);
  const paraComprar = productos
    .filter((p) => getStatus(p, stockItems) === STATUS.COMPRAR)
    .slice(0, 4);

  const pct = (n) => (resumen.total ? Math.round((n / resumen.total) * 100) : 0);

  // Índice de tranquilidad: agregación nueva sobre todo lo que ya se
  // calcula en el resto del Dashboard (stockLogic, lotes/wasteIntelligence,
  // predictions). No duplica ninguno de esos cálculos, solo los consume.
  const tranquilidad = useMemo(
    () =>
      calcularTranquilidad(productos, stockItems, eventos, {
        umbralDias,
        incluirPrediccion: preferencias?.tranquilidadIncluyePrediccion ?? true,
        incluirVencimientos: preferencias?.tranquilidadIncluyeVencimientos ?? true
      }),
    [
      productos,
      stockItems,
      eventos,
      umbralDias,
      preferencias?.tranquilidadIncluyePrediccion,
      preferencias?.tranquilidadIncluyeVencimientos
    ]
  );

  // Voy al súper: agregación nueva que combina stock + críticos +
  // vencimientos + predicción + historial de precios. No duplica ninguno
  // de esos cálculos, igual que el índice de tranquilidad.
  const propuestaCompra = useMemo(
    () =>
      generarPropuestaCompra(productos, stockItems, eventos, historialCompras, {
        incluirPrediccion: preferencias?.voyAlSuperIncluyePrediccion ?? true,
        incluirVencimientos: preferencias?.voyAlSuperIncluyeVencimientos ?? true,
        incluirCriticos: preferencias?.voyAlSuperIncluyeCriticos ?? true,
        diasParaCompraProxima: preferencias?.diasParaCompraProxima || 14,
        umbralDiasVencimiento: umbralDias
      }),
    [
      productos,
      stockItems,
      eventos,
      historialCompras,
      umbralDias,
      preferencias?.voyAlSuperIncluyePrediccion,
      preferencias?.voyAlSuperIncluyeVencimientos,
      preferencias?.voyAlSuperIncluyeCriticos,
      preferencias?.diasParaCompraProxima
    ]
  );

  // Predicciones: priorizamos lo que se va a terminar antes.
  const predicciones = useMemo(
    () =>
      productos
        .map((p) => ({ producto: p, prediccion: calcularPrediccion(p, eventos, stockItems) }))
        .filter((x) => x.prediccion.estado === 'ok')
        .sort((a, b) => a.prediccion.diasRestantes - b.prediccion.diasRestantes)
        .slice(0, 3),
    [productos, eventos, stockItems]
  );

  // Inteligencia por vencimiento: se calcula completa una sola vez (para la
  // tarjeta resumen Y para el modal de detalle, sin duplicar lógica).
  const vencidos = useMemo(() => productosVencidos(productos, stockItems), [productos, stockItems]);
  const proximosAVencer = useMemo(
    () => productosProximosAVencer(productos, stockItems, umbralDias),
    [productos, stockItems, umbralDias]
  );
  const riesgo = useMemo(
    () => calcularRiesgoDesperdicio(productos, stockItems, umbralDias),
    [productos, stockItems, umbralDias]
  );
  const consumoRecomendado = useMemo(
    () => ordenConsumoRecomendado(productos, stockItems, umbralDias, 5),
    [productos, stockItems, umbralDias]
  );
  const sugerenciasCompra = useMemo(
    () => recomendacionesCompra(productos, stockItems, umbralDias),
    [productos, stockItems, umbralDias]
  );

  // Despensa totalmente vacía: mensaje claro de "empezá por acá" en vez de
  // mostrar cuatro tarjetas en cero, que no le dicen nada a alguien nuevo.
  if (resumen.total === 0) {
    return (
      <div>
        <div className="empty-state">
          <span className="empty-state__icon">🫙</span>
          <p className="empty-state__title">Todavía no tenés productos cargados</p>
          <p className="empty-state__text">
            Agregá lo que tenés en casa (almacén, limpieza, higiene...) para empezar a controlar el stock.
          </p>
          <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={onVerStock}>
            + Agregar tu primer producto
          </button>
        </div>
        <BudgetCard preferencias={preferencias} historialCompras={historialCompras} onIrAjustes={onIrAjustes} />
      </div>
    );
  }

  return (
    <div>
      <div className="shelf-hero">
        <p className="shelf-hero__count">{resumen.total}</p>
        <p className="shelf-hero__label">productos en tu despensa</p>
      </div>

      <div className="shelf-grid">
        <button className="jar-tile jar-tile--ok" onClick={onVerStock} style={{ border: 'none', textAlign: 'left' }}>
          <div className="jar-tile__label">OK</div>
          <div className="jar-tile__value">{resumen.ok}</div>
          <div className="jar-tile__bar-track">
            <div className="jar-tile__bar-fill" style={{ width: `${pct(resumen.ok)}%` }} />
          </div>
        </button>
        <button className="jar-tile jar-tile--warn" onClick={onVerStock} style={{ border: 'none', textAlign: 'left' }}>
          <div className="jar-tile__label">Por agotarse</div>
          <div className="jar-tile__value">{resumen.porAgotarse}</div>
          <div className="jar-tile__bar-track">
            <div className="jar-tile__bar-fill" style={{ width: `${pct(resumen.porAgotarse)}%` }} />
          </div>
        </button>
        <button className="jar-tile jar-tile--danger" onClick={onVerCompras} style={{ border: 'none', textAlign: 'left' }}>
          <div className="jar-tile__label">Comprar</div>
          <div className="jar-tile__value">{resumen.comprar}</div>
          <div className="jar-tile__bar-track">
            <div className="jar-tile__bar-fill" style={{ width: `${pct(resumen.comprar)}%` }} />
          </div>
        </button>
        <div className="jar-tile jar-tile--total">
          <div className="jar-tile__label">Total</div>
          <div className="jar-tile__value">{resumen.total}</div>
          <div className="jar-tile__bar-track">
            <div className="jar-tile__bar-fill" style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {mostrarTranquilidad && (
        <TranquilidadCard resultado={tranquilidad} onVerDetalles={() => setMostrarDetalleTranquilidad(true)} />
      )}

      <VoyAlSuperCard propuesta={propuestaCompra} moneda={preferencias?.moneda} onVerPropuesta={onVerVoyAlSuper} />

      {resumen.comprar + resumen.porAgotarse > 0 ? (
        <div className="dashboard-callout">
          <span className="dashboard-callout__icon">🧺</span>
          <p className="dashboard-callout__text">
            Tenés <strong>{resumen.comprar + resumen.porAgotarse} productos</strong> para vigilar.
            Mirá la lista de compras para no quedarte sin nada.
          </p>
        </div>
      ) : (
        <div className="dashboard-callout">
          <span className="dashboard-callout__icon">✅</span>
          <p className="dashboard-callout__text">
            Tu despensa está <strong>al día</strong>. Ningún producto necesita reposición ahora.
          </p>
        </div>
      )}

      {resumenCriticos.total > 0 && (
        <>
          <p className="section-title">⭐ Productos críticos</p>
          <div className="criticos-card">
            <div className="criticos-card__stat criticos-card__stat--ok">
              <span className="criticos-card__value">{resumenCriticos.ok}</span>
              <span className="criticos-card__label">OK</span>
            </div>
            <div className="criticos-card__stat criticos-card__stat--warn">
              <span className="criticos-card__value">{resumenCriticos.porAgotarse}</span>
              <span className="criticos-card__label">Por agotarse</span>
            </div>
            <div className="criticos-card__stat criticos-card__stat--danger">
              <span className="criticos-card__value">{resumenCriticos.comprar}</span>
              <span className="criticos-card__label">Comprar</span>
            </div>
          </div>
        </>
      )}

      {paraComprar.length > 0 && (
        <>
          <p className="section-title">
            Para comprar ya
            <span className="section-title__hint" onClick={onVerCompras}>Ver todo</span>
          </p>
          <div className="mini-list">
            {paraComprar.map((p) => (
              <div className="mini-list__item" key={p.id}>
                <div>
                  <div className="mini-list__name">{esProductoCritico(p) && '⭐ '}{p.nombre}</div>
                  <div className="mini-list__sub">{p.categoria}</div>
                </div>
                <div className="mini-list__sub">Quedan {getTotal(p, stockItems)} {p.unidad}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <VencimientosCard
        riesgo={riesgo}
        moneda={preferencias?.moneda}
        onVerDetalles={() => setMostrarDetalleVencimientos(true)}
      />

      <BudgetCard preferencias={preferencias} historialCompras={historialCompras} onIrAjustes={onIrAjustes} />

      {predicciones.length > 0 && (
        <>
          <p className="section-title">Predicciones</p>
          {predicciones.map(({ producto, prediccion }) => (
            <PredictionCard
              key={producto.id}
              nombre={producto.nombre}
              prediccion={prediccion}
              variant="card"
              critico={esProductoCritico(producto)}
            />
          ))}
        </>
      )}

      {mostrarDetalleVencimientos && (
        <VencimientosDetalle
          vencidos={vencidos}
          proximos={proximosAVencer}
          consumoRecomendado={consumoRecomendado}
          recomendacionesCompra={sugerenciasCompra}
          onClose={() => setMostrarDetalleVencimientos(false)}
        />
      )}

      {mostrarDetalleTranquilidad && (
        <TranquilidadDetalle resultado={tranquilidad} onClose={() => setMostrarDetalleTranquilidad(false)} />
      )}
    </div>
  );
}
