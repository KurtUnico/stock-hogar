import React from 'react';
import { useEffect, useState } from 'react';
import { soportaNotificaciones, pedirPermiso, permisoActual, mostrarNotificacionLocal } from '../utils/notifications';
import { numeroPositivo } from '../utils/numeros';
import { useAuth } from '../contexts/AuthContext';
import AuthPanel from './auth/AuthPanel';
import { hayDatosLocalesParaMigrar, migrarDatosLocales } from '../lib/migration';

const MONEDAS = ['UYU', 'USD', 'ARS', 'EUR'];

const ESTADO_TEXTO = {
  granted: 'Activadas',
  denied: 'Bloqueadas por el navegador',
  default: 'No activadas',
  unsupported: 'No disponibles en este navegador'
};

const ESTADO_CLASE = {
  granted: 'notify-status--granted',
  denied: 'notify-status--denied',
  default: 'notify-status--default',
  unsupported: 'notify-status--denied'
};

const SYNC_TEXTO = {
  local: 'Modo local (sin cuenta)',
  synced: 'Sincronizado',
  offline: 'Sin conexión — usando copia local',
  error: 'Error al sincronizar',
  cargando: 'Conectando...'
};

const SYNC_CLASE = {
  local: 'sync-pill--local',
  synced: 'sync-pill--synced',
  offline: 'sync-pill--offline',
  error: 'sync-pill--error',
  cargando: 'sync-pill--local'
};

export default function Settings({ categorias, onRestablecer, onBorrarTodo, onAviso, preferencias, onGuardarPreferencias, syncStatus = 'local', onDatosMigrados }) {
  const { supabaseConfigurado, session, user, householdId, signOut } = useAuth();
  const [permiso, setPermiso] = useState('default');
  const [monto, setMonto] = useState(preferencias?.presupuestoMensual || 0);
  const [moneda, setMoneda] = useState(preferencias?.moneda || 'UYU');
  const [diasVencimiento, setDiasVencimiento] = useState(preferencias?.diasProximoVencimiento || 30);
  const [diasCompraProxima, setDiasCompraProxima] = useState(preferencias?.diasParaCompraProxima || 14);
  const [migrandoManual, setMigrandoManual] = useState(false);
  const [errorMigracionManual, setErrorMigracionManual] = useState('');

  useEffect(() => {
    setPermiso(permisoActual());
  }, []);

  useEffect(() => {
    setMonto(preferencias?.presupuestoMensual || 0);
    setMoneda(preferencias?.moneda || 'UYU');
    setDiasVencimiento(preferencias?.diasProximoVencimiento || 30);
    setDiasCompraProxima(preferencias?.diasParaCompraProxima || 14);
  }, [preferencias]);

  const guardarPresupuesto = () => {
    onGuardarPreferencias({ presupuestoMensual: numeroPositivo(monto), moneda });
    onAviso('Presupuesto guardado');
  };

  const guardarDiasVencimiento = () => {
    const valor = Math.max(1, Math.round(numeroPositivo(diasVencimiento)) || 30);
    setDiasVencimiento(valor);
    onGuardarPreferencias({ diasProximoVencimiento: valor });
    onAviso('Umbral de vencimiento guardado');
  };

  const guardarDiasCompraProxima = () => {
    const valor = Math.max(1, Math.round(numeroPositivo(diasCompraProxima)) || 14);
    setDiasCompraProxima(valor);
    onGuardarPreferencias({ diasParaCompraProxima: valor });
    onAviso('Días para compra próxima guardados');
  };

  const activarNotificaciones = async () => {
    const resultado = await pedirPermiso();
    setPermiso(resultado);
    if (resultado === 'granted') onAviso('Notificaciones activadas');
  };

  const probarNotificacion = async () => {
    const ok = await mostrarNotificacionLocal(
      'Stock Hogar',
      'Esta es una notificación de prueba. Así te avisaremos cuando algo se esté por terminar.'
    );
    onAviso(ok ? 'Notificación enviada' : 'No se pudo enviar la notificación');
  };

  const handleRestablecerClick = () => {
    if (window.confirm('¿Restablecer a los datos de ejemplo? Vas a perder los productos, compras e historial que cargaste hasta ahora.')) {
      onRestablecer();
    }
  };

  const handleBorrarTodoClick = () => {
    if (window.confirm('¿Borrar todos los datos de la app? Esta acción no se puede deshacer.')) {
      onBorrarTodo();
    }
  };

  const handleCerrarSesion = async () => {
    if (!window.confirm('¿Cerrar sesión? La app va a volver a mostrar los datos guardados en este dispositivo.')) return;
    try {
      await signOut();
      onAviso('Sesión cerrada');
    } catch (err) {
      onAviso('No se pudo cerrar sesión');
    }
  };

  const handleMigrarManual = async () => {
    if (!user || !householdId) return;
    setMigrandoManual(true);
    setErrorMigracionManual('');
    try {
      await migrarDatosLocales(user.id, householdId);
      onAviso('Datos subidos a tu cuenta');
      onDatosMigrados?.();
    } catch (err) {
      setErrorMigracionManual(err.message || 'No se pudo migrar los datos. Probá de nuevo.');
    } finally {
      setMigrandoManual(false);
    }
  };

  const sesionActiva = Boolean(session);

  return (
    <div>
      <p className="section-title" style={{ marginTop: 4 }}>Cuenta</p>
      <div className="settings-card">
        {!supabaseConfigurado ? (
          <p>
            Esta instalación todavía no tiene la nube configurada (faltan variables de entorno de
            Supabase). La app funciona en modo local, sin cuenta. Ver <code>SUPABASE_SETUP.md</code>.
          </p>
        ) : !sesionActiva ? (
          <>
            <p>
              Iniciá sesión o creá una cuenta para guardar tus datos en la nube y tenerlos disponibles
              en más de un dispositivo. Si no lo hacés, la app sigue funcionando igual, solo en este
              dispositivo.
            </p>
            <AuthPanel onAviso={onAviso} />
          </>
        ) : (
          <>
            <span className={`sync-pill ${SYNC_CLASE[syncStatus] || SYNC_CLASE.local}`}>
              ● {SYNC_TEXTO[syncStatus] || SYNC_TEXTO.local}
            </span>
            <div className="account-row">
              <span className="account-row__label">Sesión iniciada como</span>
              <span className="account-row__value">{user?.email}</span>
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn btn--ghost" onClick={handleCerrarSesion}>Cerrar sesión</button>
            </div>

            {householdId && hayDatosLocalesParaMigrar() && (
              <div style={{ marginTop: 14, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                <p style={{ marginTop: 0, marginBottom: 8 }}>
                  Hay datos guardados en este dispositivo de antes de iniciar sesión.
                </p>
                {errorMigracionManual && (
                  <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{errorMigracionManual}</p>
                )}
                <button className="btn btn--accent btn--sm" onClick={handleMigrarManual} disabled={migrandoManual}>
                  {migrandoManual ? 'Subiendo datos...' : 'Migrar datos locales a la nube'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="section-title">Notificaciones</p>
      <div className="settings-card">
        <span className={`notify-status ${ESTADO_CLASE[permiso] || 'notify-status--default'}`}>
          ● {ESTADO_TEXTO[permiso] || ESTADO_TEXTO.default}
        </span>
        <p>
          Cuando un producto baja del stock mínimo, Stock Hogar puede avisarte con una notificación
          local. Más adelante esto se va a poder conectar a un servidor para recibir avisos
          aunque tengas la app cerrada.
        </p>
        <div className="btn-row">
          {permiso !== 'granted' && soportaNotificaciones() && (
            <button className="btn btn--primary" onClick={activarNotificaciones}>Activar avisos</button>
          )}
          {permiso === 'granted' && (
            <button className="btn btn--ghost" onClick={probarNotificacion}>Probar notificación</button>
          )}
        </div>
      </div>

      <p className="section-title">Presupuesto mensual</p>
      <div className="settings-card">
        <p>
          Definí cuánto querés gastar por mes en estos productos. Lo vas a ver reflejado en Inicio y
          durante la compra activa.
        </p>
        <div className="field-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Monto mensual</label>
            <input type="number" min="0" step="any" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              {MONEDAS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn--primary" onClick={guardarPresupuesto}>Guardar presupuesto</button>
        </div>
      </div>

      <p className="section-title">Vencimientos</p>
      <div className="settings-card">
        <p>
          A cuántos días definimos "próximo a vencer" — afecta los avisos en Inicio, el detalle de
          producto y la compra activa.
        </p>
        <div className="field-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Días de anticipación</label>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={diasVencimiento}
              onChange={(e) => setDiasVencimiento(e.target.value)}
            />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn--primary" onClick={guardarDiasVencimiento}>Guardar umbral</button>
        </div>
      </div>

      <p className="section-title">🏠 Tranquilidad del hogar</p>
      <div className="settings-card">
        <p>
          El índice de tranquilidad resume en un solo número qué tan abastecido está tu hogar. Acá
          podés ajustar qué factores entran en el cálculo.
        </p>
        <div className="toggle-row">
          <span>Mostrar tarjeta de tranquilidad en Inicio</span>
          <button
            className={`switch ${preferencias?.mostrarTranquilidadDashboard ?? true ? 'is-on' : ''}`}
            onClick={() => {
              const nuevo = !(preferencias?.mostrarTranquilidadDashboard ?? true);
              onGuardarPreferencias({ mostrarTranquilidadDashboard: nuevo });
              onAviso(nuevo ? 'Tarjeta de tranquilidad activada' : 'Tarjeta de tranquilidad ocultada');
            }}
            aria-label="Mostrar tranquilidad en dashboard"
          >
            <span className="switch__knob" />
          </button>
        </div>
        <div className="toggle-row">
          <span>Incluir predicción de consumo en el cálculo</span>
          <button
            className={`switch ${preferencias?.tranquilidadIncluyePrediccion ?? true ? 'is-on' : ''}`}
            onClick={() => {
              const nuevo = !(preferencias?.tranquilidadIncluyePrediccion ?? true);
              onGuardarPreferencias({ tranquilidadIncluyePrediccion: nuevo });
              onAviso('Preferencia de tranquilidad guardada');
            }}
            aria-label="Incluir predicción en tranquilidad"
          >
            <span className="switch__knob" />
          </button>
        </div>
        <div className="toggle-row" style={{ paddingBottom: 0 }}>
          <span>Incluir vencimientos en el cálculo</span>
          <button
            className={`switch ${preferencias?.tranquilidadIncluyeVencimientos ?? true ? 'is-on' : ''}`}
            onClick={() => {
              const nuevo = !(preferencias?.tranquilidadIncluyeVencimientos ?? true);
              onGuardarPreferencias({ tranquilidadIncluyeVencimientos: nuevo });
              onAviso('Preferencia de tranquilidad guardada');
            }}
            aria-label="Incluir vencimientos en tranquilidad"
          >
            <span className="switch__knob" />
          </button>
        </div>
      </div>

      <p className="section-title">🛒 Voy al súper</p>
      <div className="settings-card">
        <p>
          Configurá cómo se arma la propuesta automática de compra cuando tocás "Voy al súper".
        </p>
        <div className="field-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Días para considerar "compra próxima"</label>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={diasCompraProxima}
              onChange={(e) => setDiasCompraProxima(e.target.value)}
            />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 12, marginBottom: 4 }}>
          <button className="btn btn--primary" onClick={guardarDiasCompraProxima}>Guardar días</button>
        </div>

        <div className="toggle-row" style={{ marginTop: 6 }}>
          <span>Incluir predicción de consumo</span>
          <button
            className={`switch ${preferencias?.voyAlSuperIncluyePrediccion ?? true ? 'is-on' : ''}`}
            onClick={() => {
              const nuevo = !(preferencias?.voyAlSuperIncluyePrediccion ?? true);
              onGuardarPreferencias({ voyAlSuperIncluyePrediccion: nuevo });
              onAviso('Preferencia de Voy al súper guardada');
            }}
            aria-label="Incluir predicción en Voy al súper"
          >
            <span className="switch__knob" />
          </button>
        </div>
        <div className="toggle-row">
          <span>Incluir vencimientos</span>
          <button
            className={`switch ${preferencias?.voyAlSuperIncluyeVencimientos ?? true ? 'is-on' : ''}`}
            onClick={() => {
              const nuevo = !(preferencias?.voyAlSuperIncluyeVencimientos ?? true);
              onGuardarPreferencias({ voyAlSuperIncluyeVencimientos: nuevo });
              onAviso('Preferencia de Voy al súper guardada');
            }}
            aria-label="Incluir vencimientos en Voy al súper"
          >
            <span className="switch__knob" />
          </button>
        </div>
        <div className="toggle-row" style={{ paddingBottom: 0 }}>
          <span>Incluir productos críticos</span>
          <button
            className={`switch ${preferencias?.voyAlSuperIncluyeCriticos ?? true ? 'is-on' : ''}`}
            onClick={() => {
              const nuevo = !(preferencias?.voyAlSuperIncluyeCriticos ?? true);
              onGuardarPreferencias({ voyAlSuperIncluyeCriticos: nuevo });
              onAviso('Preferencia de Voy al súper guardada');
            }}
            aria-label="Incluir productos críticos en Voy al súper"
          >
            <span className="switch__knob" />
          </button>
        </div>
      </div>

      <p className="section-title">Categorías</p>
      <div className="settings-card">
        <p>Estas son las categorías disponibles hoy. Podés agregar nuevas desde el formulario de producto.</p>
        <div className="tag-list">
          {categorias.map((cat) => (
            <span className="tag-pill" key={cat}>{cat}</span>
          ))}
        </div>
      </div>

      <p className="section-title">Datos</p>
      <div className="settings-card">
        {sesionActiva ? (
          <>
            <p>
              Tus datos se guardan en tu cuenta (en la nube) y además se mantiene una copia en este
              dispositivo para poder seguir usando la app sin conexión.
            </p>
            <p style={{ marginTop: -6 }}>
              Para borrar productos o compras puntuales, hacelo desde Stock o Compras. "Restablecer" y
              "Borrar todo" son acciones de mantenimiento del modo local y no están disponibles con
              sesión iniciada, para evitar borrar datos compartidos con otros dispositivos por error.
            </p>
          </>
        ) : (
          <>
            <p>
              Todo se guarda únicamente en este dispositivo (almacenamiento local del navegador), no se
              envía a ningún servidor. Si desinstalás la app o borrás los datos del navegador, se pierde.
            </p>
            <p style={{ marginTop: -6 }}>
              Las dos acciones de abajo son irreversibles y te van a pedir confirmación antes de aplicarse.
            </p>
            <div className="btn-row">
              <button className="btn btn--ghost" onClick={handleRestablecerClick}>Restablecer datos de ejemplo</button>
              <button className="btn btn--danger" onClick={handleBorrarTodoClick}>Borrar todo</button>
            </div>
          </>
        )}
      </div>

      <p className="section-title">Acerca de</p>
      <div className="settings-card">
        <h3>Stock Hogar · v1.8</h3>
        <p>
          Gestión simple del stock de tu casa, compra activa con precios, historial, predicciones de
          consumo, inteligencia por vencimiento (FEFO, riesgo de desperdicio), productos críticos,
          índice de tranquilidad del hogar y modo "Voy al súper" (propuesta de compra automática).
          Funciona sin conexión, y opcionalmente sincronizada con tu cuenta.
        </p>
      </div>
    </div>
  );
}
