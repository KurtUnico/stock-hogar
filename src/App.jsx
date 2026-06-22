import React from 'react';
import { useEffect, useRef, useState } from 'react';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import StockList from './components/StockList';
import ShoppingList from './components/ShoppingList';
import Settings from './components/Settings';
import Modal from './components/Modal';
import ProductForm from './components/ProductForm';
import MigratePrompt from './components/auth/MigratePrompt';
import {
  ensureSeed,
  ensureMigrationV2,
  ensureMigrationV3,
  ensureMigrationV4,
  loadProducts,
  saveProducts,
  loadCategories,
  saveCategories,
  loadManualItems,
  saveManualItems,
  resetToSampleData,
  clearAllData,
  loadLastNotifyDate,
  saveLastNotifyDate,
  loadActivePurchase,
  saveActivePurchase,
  loadPurchaseHistory,
  savePurchaseHistory,
  loadStockEvents,
  saveStockEvents,
  loadStockItems,
  saveStockItems,
  loadPreferences,
  savePreferences
} from './utils/storage';
import { debeComprarse, getStatus, getTotal, STATUS } from './utils/stockLogic';
import { crearLote, incrementarGenerico, consumirFEFO } from './utils/lotes';
import { permisoActual, mostrarNotificacionLocal } from './utils/notifications';
import { crearEvento, TIPO_EVENTO } from './utils/stockEvents';
import { formatMoneda } from './utils/historial';
import { numeroPositivo } from './utils/numeros';
import { useAuth } from './contexts/AuthContext';
import * as cloud from './lib/cloudRepo';
import { guardarCacheCompleta, leerCacheCompleta } from './lib/cloudCache';
import { debeOfrecerMigracion, migrarDatosLocales, descartarMigracionEnEsteNavegador } from './lib/migration';

const TAB_SUBTITLE = {
  dashboard: 'Resumen de tu despensa',
  stock: 'Todo tu stock, en un lugar',
  compras: 'Lo que falta reponer',
  ajustes: 'Notificaciones y datos'
};

export default function App() {
  const {
    session,
    user,
    householdId,
    cargandoSesion,
    cargandoHogar,
    errorHogar,
    isOnline,
    modoNube
  } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [vistaComprasInicial, setVistaComprasInicial] = useState(null);
  const [filtroStockInicial, setFiltroStockInicial] = useState(null);
  // Navegación normal (BottomNav, ícono del header, "Ver todo", etc.): si no
  // es específicamente "ir a Voy al súper", no forzamos ninguna sub-vista
  // dentro de Compras — el usuario entra donde corresponda por defecto
  // (lista, o compra activa si hay una en curso).
  const cambiarTab = (tab) => {
    setVistaComprasInicial(null);
    setFiltroStockInicial(null);
    setActiveTab(tab);
  };
  const [productos, setProductos] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [manualItems, setManualItems] = useState([]);
  const [productoEditando, setProductoEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [toast, setToast] = useState('');

  const [compraActiva, setCompraActiva] = useState(null);
  const [historialCompras, setHistorialCompras] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [preferencias, setPreferencias] = useState({
    presupuestoMensual: 0,
    moneda: 'UYU',
    diasProximoVencimiento: 30,
    mostrarTranquilidadDashboard: true,
    tranquilidadIncluyePrediccion: true,
    tranquilidadIncluyeVencimientos: true,
    diasParaCompraProxima: 14,
    voyAlSuperIncluyePrediccion: true,
    voyAlSuperIncluyeVencimientos: true,
    voyAlSuperIncluyeCriticos: true
  });

  // --- Estado de sincronización con Supabase ---
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [syncStatus, setSyncStatus] = useState('local'); // local | cargando | synced | offline | error
  const [mostrarMigracion, setMostrarMigracion] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [errorMigracion, setErrorMigracion] = useState('');

  const prevStatusRef = useRef(null);
  // Espejo del estado actual, para que el listener de "volvió la conexión"
  // (que se registra una sola vez) siempre lea datos frescos sin tener que
  // recrearse en cada cambio de estado.
  const estadoRef = useRef(null);
  useEffect(() => {
    estadoRef.current = { productos, stockItems, categorias, manualItems, compraActiva, historialCompras, eventos, preferencias };
  });

  // Aplica un snapshot completo (de Supabase, de la caché local, o del
  // localStorage 100% local) a todo el estado de la app de una sola vez.
  const aplicarDatos = (datos) => {
    setProductos(datos.productos);
    setStockItems(datos.stockItems || []);
    setCategorias(datos.categorias);
    setManualItems(datos.manualItems);
    setCompraActiva(datos.compraActiva);
    setHistorialCompras(datos.historialCompras);
    setEventos(datos.eventos);
    setPreferencias(datos.preferencias);
    // Nueva base: evita que el efecto de "agregado_lista" compare contra
    // el estado de la fuente de datos anterior (local vs. nube) y dispare
    // eventos falsos justo al cambiar de modo.
    prevStatusRef.current = null;
  };

  // Guarda en la caché local de modo-nube el snapshot actual + los cambios
  // que se acaban de aplicar a UNA entidad (las demás quedan como están).
  const cacheParcial = (cambios) => {
    guardarCacheCompleta({
      productos,
      stockItems,
      categorias,
      manualItems,
      compraActiva,
      historialCompras,
      eventos,
      preferencias,
      ...cambios
    });
  };

  // Best-effort: dispara la sincronización contra Supabase sin bloquear la
  // UI (que ya se actualizó de forma local/optimista antes de llamar acá).
  const sincronizarNube = (promesa) => {
    promesa
      .then(() => setSyncStatus('synced'))
      .catch((err) => {
        console.warn('Error sincronizando con Supabase', err);
        setSyncStatus(isOnline ? 'error' : 'offline');
      });
  };

  // ---------------------------------------------------------------------
  // Carga inicial / cambio de modo (sin sesión <-> con sesión y hogar listo)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (cargandoSesion) return;
    if (session && cargandoHogar) return;

    let cancelado = false;

    (async () => {
      setCargandoDatos(true);

      if (modoNube) {
        setSyncStatus('cargando');
        try {
          const datos = await cloud.cargarTodo(householdId);
          if (cancelado) return;
          aplicarDatos(datos);
          guardarCacheCompleta(datos);
          setSyncStatus('synced');

          const ofrecer = await debeOfrecerMigracion(user.id, householdId);
          if (!cancelado && ofrecer) setMostrarMigracion(true);
        } catch (err) {
          console.warn('No se pudo cargar desde Supabase, usando la copia local', err);
          if (cancelado) return;
          aplicarDatos(leerCacheCompleta());
          setSyncStatus('offline');
        }
      } else if (session && errorHogar) {
        // Hay sesión pero no se pudo resolver el hogar (sin red al loguearse,
        // problema puntual de RLS, etc.): seguimos con la última copia local.
        aplicarDatos(leerCacheCompleta());
        setSyncStatus('offline');
      } else {
        // Modo 100% local, exactamente como antes de esta evolución.
        ensureSeed();
        ensureMigrationV2();
        ensureMigrationV3(); // productos/lotes: cantidadUso+cantidadDespensa -> StockItem
        ensureMigrationV4(); // productos: agrega esCritico = false
        aplicarDatos({
          productos: loadProducts(),
          stockItems: loadStockItems(),
          categorias: loadCategories(),
          manualItems: loadManualItems(),
          compraActiva: loadActivePurchase(),
          historialCompras: loadPurchaseHistory(),
          eventos: loadStockEvents(),
          preferencias: loadPreferences()
        });
        setSyncStatus('local');
      }

      if (!cancelado) setCargandoDatos(false);
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoNube, householdId, cargandoSesion, cargandoHogar, session, errorHogar]);

  // ---------------------------------------------------------------------
  // Reconciliar al recuperar conexión (versión simple: reenvía lo que es
  // "estado completo" -productos, lotes, categorías, lista, compra activa,
  // preferencias- y, para los registros de solo-inserción -historial y
  // eventos-, compara contra la nube y empuja lo que falte. Después
  // refresca todo. Ver SUPABASE_SETUP.md para las limitaciones de este
  // enfoque "v1 simple" de sincronización.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!modoNube) return;

    const reconciliar = async () => {
      const estado = estadoRef.current;
      if (!estado) return;
      setSyncStatus('cargando');
      try {
        if (estado.productos.length > 0) await cloud.guardarProductos(householdId, estado.productos);
        if (estado.stockItems.length > 0) await cloud.guardarLotes(householdId, estado.stockItems);
        for (const nombre of estado.categorias) {
          await cloud.agregarCategoriaCloud(householdId, nombre);
        }
        await cloud.reemplazarListaManual(householdId, estado.manualItems);
        await cloud.guardarCompraActiva(householdId, estado.compraActiva);
        await cloud.guardarPreferenciasCloud(householdId, estado.preferencias);

        const historialNube = await cloud.cargarHistorial(householdId);
        const idsHistorialNube = new Set(historialNube.map((h) => h.id));
        const historialPendiente = estado.historialCompras.filter((h) => !idsHistorialNube.has(h.id));
        for (const registro of historialPendiente) {
          try {
            await cloud.insertarCompraCerrada(householdId, registro);
          } catch (err) {
            if (err?.code !== '23505') throw err;
          }
        }

        const eventosNube = await cloud.cargarEventos(householdId);
        const idsEventosNube = new Set(eventosNube.map((e) => e.id));
        const eventosPendientes = estado.eventos.filter((e) => !idsEventosNube.has(e.id));
        if (eventosPendientes.length > 0) {
          try {
            await cloud.insertarEventos(householdId, eventosPendientes);
          } catch (err) {
            if (err?.code !== '23505') throw err;
          }
        }

        const datosFinales = await cloud.cargarTodo(householdId);
        aplicarDatos(datosFinales);
        guardarCacheCompleta(datosFinales);
        setSyncStatus('synced');
      } catch (err) {
        console.warn('No se pudo reconciliar al reconectar', err);
        setSyncStatus('error');
      }
    };

    window.addEventListener('online', reconciliar);
    return () => window.removeEventListener('online', reconciliar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoNube, householdId]);

  // Chequeo diario (simulado): si hay productos para comprar y ya hay permiso
  // de notificaciones, avisa una vez por día. Esto simula lo que en el
  // futuro dispararía un push real desde un backend.
  useEffect(() => {
    if (productos.length === 0) return;
    if (permisoActual() !== 'granted') return;
    const hoy = new Date().toISOString().slice(0, 10);
    if (loadLastNotifyDate() === hoy) return;
    const aComprar = productos.filter((p) => debeComprarse(p, stockItems) && p.notificacionActiva);
    if (aComprar.length === 0) return;
    mostrarNotificacionLocal(
      'Stock Hogar',
      `Tenés ${aComprar.length} producto${aComprar.length > 1 ? 's' : ''} para reponer.`
    );
    saveLastNotifyDate(hoy);
  }, [productos, stockItems]);

  // Detecta transiciones de estado (OK -> por agotarse/comprar) para
  // registrar el evento "agregado_lista", sin spamear en la primera carga.
  // El estado depende de productos Y de los lotes, así que el efecto mira
  // ambos.
  useEffect(() => {
    if (productos.length === 0) return;
    const statusActual = {};
    productos.forEach((p) => {
      statusActual[p.id] = getStatus(p, stockItems);
    });

    if (prevStatusRef.current) {
      const nuevosEventos = [];
      productos.forEach((p) => {
        const antes = prevStatusRef.current[p.id];
        const ahora = statusActual[p.id];
        const pasoAComprar = ahora !== STATUS.OK && (antes === undefined || antes === STATUS.OK);
        if (pasoAComprar) {
          nuevosEventos.push(crearEvento(p.id, TIPO_EVENTO.AGREGADO_LISTA, getTotal(p, stockItems)));
        }
      });
      if (nuevosEventos.length > 0) {
        setEventos((prev) => {
          const actualizado = [...prev, ...nuevosEventos];
          if (modoNube) {
            cacheParcial({ eventos: actualizado });
          } else {
            saveStockEvents(actualizado);
          }
          return actualizado;
        });
        if (modoNube) sincronizarNube(cloud.insertarEventos(householdId, nuevosEventos));
      }
    }
    prevStatusRef.current = statusActual;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, stockItems]);

  const avisar = (msg) => {
    setToast(msg);
    window.clearTimeout(avisar._t);
    avisar._t = window.setTimeout(() => setToast(''), 2400);
  };

  // ---------------------------------------------------------------------
  // Persistencia: local "de toda la vida" si no hay sesión, o
  // local-cache + Supabase (best-effort) si hay sesión activa.
  // ---------------------------------------------------------------------
  const persistirProductos = (lista) => {
    setProductos(lista);
    if (modoNube) {
      cacheParcial({ productos: lista });
      sincronizarNube(cloud.guardarProductos(householdId, lista));
    } else {
      saveProducts(lista);
    }
  };

  const persistirStockItems = (lista) => {
    setStockItems(lista);
    if (modoNube) {
      cacheParcial({ stockItems: lista });
      sincronizarNube(cloud.guardarLotes(householdId, lista));
    } else {
      saveStockItems(lista);
    }
  };

  const persistirManuales = (lista) => {
    setManualItems(lista);
    if (modoNube) {
      cacheParcial({ manualItems: lista });
      sincronizarNube(cloud.reemplazarListaManual(householdId, lista));
    } else {
      saveManualItems(lista);
    }
  };

  const registrarEvento = (productoId, tipo, cantidad) => {
    const nuevo = crearEvento(productoId, tipo, cantidad);
    setEventos((prev) => {
      const actualizado = [...prev, nuevo];
      if (modoNube) {
        cacheParcial({ eventos: actualizado });
      } else {
        saveStockEvents(actualizado);
      }
      return actualizado;
    });
    if (modoNube) sincronizarNube(cloud.insertarEventos(householdId, [nuevo]));
  };

  const persistirCompraActiva = (compra) => {
    setCompraActiva(compra);
    if (modoNube) {
      cacheParcial({ compraActiva: compra });
      sincronizarNube(cloud.guardarCompraActiva(householdId, compra));
    } else {
      saveActivePurchase(compra);
    }
  };

  // ---- Productos ----
  // Botones rápidos +/- de StockList: ya no tocan un número en el producto,
  // ajustan los LOTES (sumar -> lote genérico; restar -> FEFO). ubicacion es
  // 'en_uso' | 'despensa'.
  const handleAjustar = (productId, ubicacion, delta) => {
    if (delta > 0) {
      const actualizado = incrementarGenerico(stockItems, productId, ubicacion, delta);
      persistirStockItems(actualizado);
      registrarEvento(productId, TIPO_EVENTO.INCREMENTO, delta);
      return;
    }
    if (delta < 0) {
      const { stockItems: actualizado, consumido, cantidadConsumida } = consumirFEFO(stockItems, productId, ubicacion, Math.abs(delta));
      if (!consumido) return; // nada para restar (el botón ya debería estar disabled en ese caso)
      persistirStockItems(actualizado);
      registrarEvento(productId, TIPO_EVENTO.DISMINUCION, cantidadConsumida);
      const producto = productos.find((p) => p.id === productId);
      if (producto && getTotal(producto, actualizado) === 0) {
        registrarEvento(productId, TIPO_EVENTO.AGOTADO, 0);
      }
    }
  };

  const abrirNuevoProducto = () => {
    setProductoEditando(null);
    setMostrarFormulario(true);
  };

  const abrirEdicionProducto = (producto) => {
    setProductoEditando(producto);
    setMostrarFormulario(true);
  };

  // datos puede traer cantidadUsoInicial/cantidadDespensaInicial/
  // vencimientoInicial (solo al CREAR, ver ProductForm) — no son campos del
  // producto, son la semilla para los lotes iniciales.
  const handleGuardarProducto = (datos) => {
    const ahora = new Date().toISOString();
    const { cantidadUsoInicial, cantidadDespensaInicial, vencimientoInicial, ...datosProducto } = datos;

    if (datosProducto.id) {
      const lista = productos.map((p) => (p.id === datosProducto.id ? { ...datosProducto, ultimaActualizacion: ahora } : p));
      persistirProductos(lista);
      avisar('Producto actualizado');
    } else {
      const nuevo = { ...datosProducto, id: crypto.randomUUID(), ultimaActualizacion: ahora };
      persistirProductos([nuevo, ...productos]);

      const lotesIniciales = [];
      const uso = numeroPositivo(cantidadUsoInicial);
      const despensa = numeroPositivo(cantidadDespensaInicial);
      if (uso > 0) {
        lotesIniciales.push(crearLote({ productId: nuevo.id, ubicacion: 'en_uso', cantidad: uso, fechaVencimiento: vencimientoInicial || null }));
      }
      if (despensa > 0) {
        lotesIniciales.push(crearLote({ productId: nuevo.id, ubicacion: 'despensa', cantidad: despensa, fechaVencimiento: vencimientoInicial || null }));
      }
      if (lotesIniciales.length > 0) {
        persistirStockItems([...lotesIniciales, ...stockItems]);
      }
      registrarEvento(nuevo.id, TIPO_EVENTO.CREACION, uso + despensa);
      avisar('Producto agregado');
    }
    setMostrarFormulario(false);
  };

  const handleEliminarProducto = (id) => {
    persistirProductos(productos.filter((p) => p.id !== id));
    if (modoNube) {
      // En la nube, borrar el producto ya borra en cascada sus stock_events
      // Y sus stock_items (FK ON DELETE CASCADE) — no hace falta un segundo
      // ni tercer viaje al servidor.
      sincronizarNube(cloud.eliminarProductoCloud(id));
    }
    const eventosSinHuerfanos = eventos.filter((e) => e.productoId !== id);
    if (eventosSinHuerfanos.length !== eventos.length) {
      setEventos(eventosSinHuerfanos);
      if (modoNube) {
        cacheParcial({ eventos: eventosSinHuerfanos });
      } else {
        saveStockEvents(eventosSinHuerfanos);
      }
    }
    const lotesSinHuerfanos = stockItems.filter((l) => l.productId !== id);
    if (lotesSinHuerfanos.length !== stockItems.length) {
      setStockItems(lotesSinHuerfanos);
      if (modoNube) {
        cacheParcial({ stockItems: lotesSinHuerfanos });
      } else {
        saveStockItems(lotesSinHuerfanos);
      }
    }
    setMostrarFormulario(false);
    avisar('Producto eliminado');
  };

  const handleAgregarCategoria = (nombre) => {
    if (categorias.includes(nombre)) return;
    const lista = [...categorias, nombre];
    setCategorias(lista);
    if (modoNube) {
      cacheParcial({ categorias: lista });
      sincronizarNube(cloud.agregarCategoriaCloud(householdId, nombre));
    } else {
      saveCategories(lista);
    }
  };

  // ---- Lotes (gestión fina desde el detalle del producto) ----
  const handleAgregarLote = (productId, datosLote) => {
    const nuevo = crearLote({ productId, ...datosLote });
    persistirStockItems([nuevo, ...stockItems]);
    registrarEvento(productId, TIPO_EVENTO.INCREMENTO, nuevo.cantidad);
    avisar('Lote agregado');
  };

  const handleEditarLote = (loteId, cambios) => {
    const anterior = stockItems.find((l) => l.id === loteId);
    if (!anterior) return;
    const cantidadNueva = 'cantidad' in cambios ? numeroPositivo(cambios.cantidad) : anterior.cantidad;
    const actualizado = stockItems.map((l) =>
      l.id === loteId ? { ...l, ...cambios, cantidad: cantidadNueva, fechaActualizacion: new Date().toISOString() } : l
    );
    persistirStockItems(actualizado);
    const delta = cantidadNueva - anterior.cantidad;
    if (delta !== 0) registrarEvento(anterior.productId, TIPO_EVENTO.AJUSTE_MANUAL, delta);
    avisar('Lote actualizado');
  };

  const handleEliminarLote = (loteId) => {
    const lote = stockItems.find((l) => l.id === loteId);
    if (!lote) return;
    persistirStockItems(stockItems.filter((l) => l.id !== loteId));
    if (modoNube) sincronizarNube(cloud.eliminarLoteCloud(loteId));
    if (lote.cantidad > 0) registrarEvento(lote.productId, TIPO_EVENTO.DISMINUCION, lote.cantidad);
    avisar('Lote eliminado');
  };

  const handleMoverLote = (loteId) => {
    const actualizado = stockItems.map((l) =>
      l.id === loteId ? { ...l, ubicacion: 'en_uso', fechaActualizacion: new Date().toISOString() } : l
    );
    persistirStockItems(actualizado);
    avisar('Lote movido a en uso');
  };

  const handleConsumirLote = (loteId) => {
    const lote = stockItems.find((l) => l.id === loteId);
    if (!lote || lote.cantidad <= 0) return;
    const restante = lote.cantidad - 1;
    const actualizado = stockItems.map((l) =>
      l.id === loteId ? { ...l, cantidad: restante, activo: restante > 0, fechaActualizacion: new Date().toISOString() } : l
    );
    persistirStockItems(actualizado);
    registrarEvento(lote.productId, TIPO_EVENTO.DISMINUCION, 1);
    const producto = productos.find((p) => p.id === lote.productId);
    if (producto && getTotal(producto, actualizado) === 0) {
      registrarEvento(lote.productId, TIPO_EVENTO.AGOTADO, 0);
    }
  };

  // ---- Lista de compras (modo simple) ----
  const handleConfirmarCompra = (productId, cantidadIngresada) => {
    const cantidad = numeroPositivo(cantidadIngresada);
    if (cantidad === 0) {
      avisar('Ingresá una cantidad mayor a 0');
      return;
    }
    const nuevoLote = crearLote({ productId, ubicacion: 'despensa', cantidad });
    persistirStockItems([nuevoLote, ...stockItems]);
    const lista = productos.map((p) => (p.id === productId ? { ...p, ultimaActualizacion: new Date().toISOString() } : p));
    persistirProductos(lista);
    registrarEvento(productId, TIPO_EVENTO.INCREMENTO, cantidad);
    avisar(`Sumaste ${cantidad} a la despensa`);
  };

  const handleAgregarManual = (nombre) => {
    const nombreLimpio = (nombre || '').trim();
    if (!nombreLimpio) return;
    const nuevo = { id: crypto.randomUUID(), nombre: nombreLimpio, cantidad: 1, comprado: false, manual: true };
    persistirManuales([nuevo, ...manualItems]);
  };

  const handleToggleManual = (id) => {
    const lista = manualItems.map((m) => (m.id === id ? { ...m, comprado: !m.comprado } : m));
    persistirManuales(lista);
  };

  const handleEliminarManual = (id) => {
    persistirManuales(manualItems.filter((m) => m.id !== id));
  };

  // ---- Compra activa ----
  const handleIniciarCompraActiva = () => {
    if (compraActiva) {
      avisar('Ya tenés una compra activa en curso');
      return;
    }
    const itemsAuto = productos.filter((p) => debeComprarse(p, stockItems)).map((p) => ({
      id: crypto.randomUUID(),
      productoId: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      cantidad: Math.max(1, p.stockMinimo - getTotal(p, stockItems)) || 1,
      unidad: p.unidad,
      precioUnitario: 0,
      subtotal: 0,
      comprado: false,
      origen: 'automatico',
      requiereVencimiento: Boolean(p.requiereVencimiento),
      esCritico: Boolean(p.esCritico),
      fechaVencimiento: null
    }));
    const manualesPendientes = manualItems.filter((m) => !m.comprado);
    const itemsManuales = manualesPendientes.map((m) => ({
      id: crypto.randomUUID(),
      productoId: null,
      nombre: m.nombre,
      categoria: '',
      cantidad: m.cantidad || 1,
      unidad: 'unidad',
      precioUnitario: 0,
      subtotal: 0,
      comprado: false,
      origen: 'manual',
      requiereVencimiento: false,
      esCritico: false,
      fechaVencimiento: null
    }));

    persistirCompraActiva({ iniciadaEn: new Date().toISOString(), items: [...itemsAuto, ...itemsManuales] });
    // Esos manuales quedan "en custodia" de la compra activa hasta que se cierre o cancele.
    persistirManuales(manualItems.filter((m) => m.comprado));
    avisar('Compra activa iniciada');
  };

  // Variante de handleIniciarCompraActiva para el modo "Voy al súper": en
  // vez de recalcular automáticamente qué comprar (debeComprarse), toma la
  // lista YA decidida por generarPropuestaCompra (urgentes + recomendados,
  // editable por el usuario antes de confirmar). No se tocó
  // handleIniciarCompraActiva ni su lógica — esto es una función nueva al
  // lado, mismo patrón de construcción de item.
  const handleIniciarCompraActivaDesdePropuesta = (itemsPropuesta) => {
    if (compraActiva) {
      avisar('Ya tenés una compra activa en curso');
      return false;
    }
    if (!itemsPropuesta || itemsPropuesta.length === 0) {
      avisar('No hay productos para agregar');
      return false;
    }
    const itemsAuto = itemsPropuesta.map(({ producto, cantidadSugerida, precioEstimado }) => ({
      id: crypto.randomUUID(),
      productoId: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
      cantidad: Math.max(1, cantidadSugerida || 1),
      unidad: producto.unidad,
      // A diferencia de la compra activa "normal" (que arranca en 0), acá
      // prellenamos con el último precio conocido si existe — es la ventaja
      // de venir de una propuesta que ya consultó el historial. Sigue
      // siendo editable antes de salir, como pide el spec.
      precioUnitario: Number(precioEstimado) || 0,
      subtotal: (Number(precioEstimado) || 0) * Math.max(1, cantidadSugerida || 1),
      comprado: false,
      origen: 'automatico',
      requiereVencimiento: Boolean(producto.requiereVencimiento),
      esCritico: Boolean(producto.esCritico),
      fechaVencimiento: null
    }));
    persistirCompraActiva({ iniciadaEn: new Date().toISOString(), items: itemsAuto });
    avisar('Compra activa creada desde la propuesta');
    return true;
  };

  const handleActualizarItemActivo = (itemId, cambios) => {
    if (!compraActiva) return;
    const items = compraActiva.items.map((it) => {
      if (it.id !== itemId) return it;
      const actualizado = { ...it, ...cambios };
      // La cantidad y el precio nunca pueden ser negativos, y el subtotal
      // siempre se recalcula acá (fuente única de verdad), sin importar qué
      // haya mandado el componente que llamó a esta función.
      if ('cantidad' in cambios || 'precioUnitario' in cambios) {
        actualizado.cantidad = numeroPositivo(actualizado.cantidad);
        actualizado.precioUnitario = numeroPositivo(actualizado.precioUnitario);
        actualizado.subtotal = actualizado.cantidad * actualizado.precioUnitario;
      }
      return actualizado;
    });
    persistirCompraActiva({ ...compraActiva, items });
  };

  const handleAgregarManualActivo = (nombre) => {
    if (!compraActiva) return;
    const nombreLimpio = (nombre || '').trim();
    if (!nombreLimpio) return;
    const nuevo = {
      id: crypto.randomUUID(),
      productoId: null,
      nombre: nombreLimpio,
      categoria: '',
      cantidad: 1,
      unidad: 'unidad',
      precioUnitario: 0,
      subtotal: 0,
      comprado: false,
      origen: 'manual',
      requiereVencimiento: false,
      esCritico: false,
      fechaVencimiento: null
    };
    persistirCompraActiva({ ...compraActiva, items: [nuevo, ...compraActiva.items] });
  };

  const handleQuitarItemActivo = (itemId) => {
    if (!compraActiva) return;
    persistirCompraActiva({ ...compraActiva, items: compraActiva.items.filter((it) => it.id !== itemId) });
  };

  // Ítems manuales que no se terminaron comprando vuelven a la lista pendiente,
  // para no perderlos al cancelar o al cerrar con cosas sin marcar.
  const devolverManualesPendientes = (items) => {
    const pendientesManuales = items
      .filter((it) => it.origen === 'manual' && !it.comprado)
      .map((it) => ({ id: crypto.randomUUID(), nombre: it.nombre, cantidad: it.cantidad, comprado: false, manual: true }));
    if (pendientesManuales.length > 0) {
      persistirManuales([...pendientesManuales, ...manualItems]);
    }
  };

  const handleCancelarCompraActiva = () => {
    if (!compraActiva) return;
    devolverManualesPendientes(compraActiva.items);
    persistirCompraActiva(null);
    avisar('Compra activa cancelada');
  };

  const handleCerrarCompraActiva = () => {
    if (!compraActiva) return;
    const enCarrito = compraActiva.items.filter((it) => it.comprado);
    if (enCarrito.length === 0) {
      avisar('No hay ítems marcados como comprados');
      return;
    }

    const ahora = new Date().toISOString();
    const total = enCarrito.reduce((s, it) => s + Number(it.subtotal || 0), 0);

    const registro = {
      id: crypto.randomUUID(),
      fecha: ahora,
      total,
      items: enCarrito.map((it) => ({
        productoId: it.productoId,
        nombre: it.nombre,
        categoria: it.categoria,
        cantidad: numeroPositivo(it.cantidad),
        unidad: it.unidad,
        precioUnitario: numeroPositivo(it.precioUnitario),
        subtotal: numeroPositivo(it.subtotal)
      }))
    };

    const historialActualizado = [registro, ...historialCompras];
    setHistorialCompras(historialActualizado);
    if (modoNube) {
      cacheParcial({ historialCompras: historialActualizado });
      sincronizarNube(cloud.insertarCompraCerrada(householdId, registro));
    } else {
      savePurchaseHistory(historialActualizado);
    }

    // Crea LOTES nuevos para cada producto comprado (no se incrementa un
    // contador agregado), y registra el evento de stock correspondiente.
    const eventosNuevos = [];
    const lotesNuevos = [];
    enCarrito.forEach((item) => {
      if (!item.productoId) return; // ítem manual sin producto vinculado: no genera lote
      const cantidadComprada = numeroPositivo(item.cantidad);
      if (cantidadComprada <= 0) return;
      lotesNuevos.push(
        crearLote({
          productId: item.productoId,
          ubicacion: 'despensa',
          cantidad: cantidadComprada,
          fechaCompra: ahora,
          fechaVencimiento: item.fechaVencimiento || null,
          precioUnitario: numeroPositivo(item.precioUnitario) || null
        })
      );
      eventosNuevos.push(crearEvento(item.productoId, TIPO_EVENTO.COMPRA_CERRADA, cantidadComprada, ahora));
    });

    if (lotesNuevos.length > 0) {
      persistirStockItems([...lotesNuevos, ...stockItems]);
    }

    const idsComprados = new Set(enCarrito.map((it) => it.productoId).filter(Boolean));
    if (idsComprados.size > 0) {
      const listaProductos = productos.map((p) => (idsComprados.has(p.id) ? { ...p, ultimaActualizacion: ahora } : p));
      persistirProductos(listaProductos);
    }

    if (eventosNuevos.length > 0) {
      const eventosActualizados = [...eventos, ...eventosNuevos];
      setEventos(eventosActualizados);
      if (modoNube) {
        cacheParcial({ eventos: eventosActualizados });
        sincronizarNube(cloud.insertarEventos(householdId, eventosNuevos));
      } else {
        saveStockEvents(eventosActualizados);
      }
    }

    devolverManualesPendientes(compraActiva.items);
    persistirCompraActiva(null);

    avisar(`Compra cerrada: ${formatMoneda(total, preferencias.moneda)}`);
  };

  // ---- Ajustes ----
  const handleGuardarPreferencias = (nuevas) => {
    const actualizado = { ...preferencias, ...nuevas };
    setPreferencias(actualizado);
    if (modoNube) {
      cacheParcial({ preferencias: actualizado });
      sincronizarNube(cloud.guardarPreferenciasCloud(householdId, actualizado));
    } else {
      savePreferences(actualizado);
    }
  };

  const handleRestablecer = () => {
    resetToSampleData();
    aplicarDatos({
      productos: loadProducts(),
      stockItems: loadStockItems(),
      categorias: loadCategories(),
      manualItems: loadManualItems(),
      compraActiva: loadActivePurchase(),
      historialCompras: loadPurchaseHistory(),
      eventos: loadStockEvents(),
      preferencias: loadPreferences()
    });
    avisar('Datos de ejemplo restablecidos');
  };

  const handleBorrarTodo = () => {
    clearAllData();
    aplicarDatos({
      productos: [],
      stockItems: [],
      categorias: loadCategories(),
      manualItems: [],
      compraActiva: null,
      historialCompras: [],
      eventos: [],
      preferencias: loadPreferences()
    });
    avisar('Datos borrados');
  };

  // ---- Cuenta / nube ----
  const recargarDesdeNube = async () => {
    if (!modoNube) return;
    setSyncStatus('cargando');
    try {
      const datos = await cloud.cargarTodo(householdId);
      aplicarDatos(datos);
      guardarCacheCompleta(datos);
      setSyncStatus('synced');
    } catch (err) {
      console.warn('No se pudo recargar desde Supabase', err);
      setSyncStatus('error');
    }
  };

  const handleMigrarDesdePrompt = async () => {
    setMigrando(true);
    setErrorMigracion('');
    try {
      await migrarDatosLocales(user.id, householdId);
      await recargarDesdeNube();
      setMostrarMigracion(false);
      avisar('Datos subidos a tu cuenta');
    } catch (err) {
      setErrorMigracion(err.message || 'No se pudo migrar. Probá de nuevo.');
    } finally {
      setMigrando(false);
    }
  };

  const handleDescartarMigracion = () => {
    if (user) descartarMigracionEnEsteNavegador(user.id);
    setMostrarMigracion(false);
  };

  const comprasCount = productos.filter((p) => debeComprarse(p, stockItems)).length + manualItems.filter((m) => !m.comprado).length;

  if (cargandoDatos) {
    return (
      <div className="app-shell">
        <div className="empty-state" style={{ marginTop: 80 }}>
          <span className="empty-state__icon">🫙</span>
          <p className="empty-state__title">Cargando Stock Hogar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__top">
          <div className="app-header__brand">
            <div className="app-header__brand-mark">🫙</div>
            <div>
              <p className="app-header__title">Stock Hogar</p>
              <p className="app-header__subtitle">{TAB_SUBTITLE[activeTab]}</p>
            </div>
          </div>
          <button className="icon-btn" onClick={() => cambiarTab('compras')} aria-label="Ir a compras">
            🛒
          </button>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            productos={productos}
            stockItems={stockItems}
            eventos={eventos}
            historialCompras={historialCompras}
            preferencias={preferencias}
            onVerCompras={() => cambiarTab('compras')}
            onVerStock={(filtro) => {
              setFiltroStockInicial(filtro || null);
              setVistaComprasInicial(null);
              setActiveTab('stock');
            }}
            onIrAjustes={() => cambiarTab('ajustes')}
            onVerVoyAlSuper={() => {
              setVistaComprasInicial('super');
              setActiveTab('compras');
            }}
          />
        )}

        {activeTab === 'stock' && (
          <StockList
            productos={productos}
            stockItems={stockItems}
            categorias={categorias}
            onAjustar={handleAjustar}
            onEditar={abrirEdicionProducto}
            onNuevo={abrirNuevoProducto}
            historialCompras={historialCompras}
            moneda={preferencias.moneda}
            filtroInicial={filtroStockInicial}
          />
        )}

        {activeTab === 'compras' && (
          <ShoppingList
            productos={productos}
            stockItems={stockItems}
            eventos={eventos}
            manualItems={manualItems}
            onConfirmarCompra={handleConfirmarCompra}
            onAgregarManual={handleAgregarManual}
            onToggleManual={handleToggleManual}
            onEliminarManual={handleEliminarManual}
            compraActiva={compraActiva}
            preferencias={preferencias}
            historialCompras={historialCompras}
            onIniciarCompraActiva={handleIniciarCompraActiva}
            onActualizarItemActivo={handleActualizarItemActivo}
            onAgregarManualActivo={handleAgregarManualActivo}
            onQuitarItemActivo={handleQuitarItemActivo}
            onCancelarCompraActiva={handleCancelarCompraActiva}
            onCerrarCompraActiva={handleCerrarCompraActiva}
            onCrearCompraActivaDesdePropuesta={handleIniciarCompraActivaDesdePropuesta}
            vistaInicial={vistaComprasInicial}
          />
        )}

        {activeTab === 'ajustes' && (
          <Settings
            categorias={categorias}
            onRestablecer={handleRestablecer}
            onBorrarTodo={handleBorrarTodo}
            onAviso={avisar}
            preferencias={preferencias}
            onGuardarPreferencias={handleGuardarPreferencias}
            syncStatus={syncStatus}
            onDatosMigrados={recargarDesdeNube}
          />
        )}
      </main>

      <BottomNav active={activeTab} onChange={cambiarTab} comprasCount={comprasCount} />

      {mostrarFormulario && (
        <Modal
          title={productoEditando ? 'Editar producto' : 'Nuevo producto'}
          onClose={() => setMostrarFormulario(false)}
        >
          <ProductForm
            producto={productoEditando}
            categorias={categorias}
            stockItems={stockItems}
            onGuardar={handleGuardarProducto}
            onEliminar={handleEliminarProducto}
            onAgregarCategoria={handleAgregarCategoria}
            onAgregarLote={handleAgregarLote}
            onEditarLote={handleEditarLote}
            onEliminarLote={handleEliminarLote}
            onMoverLote={handleMoverLote}
            onConsumirLote={handleConsumirLote}
            eventos={eventos}
            historialCompras={historialCompras}
            moneda={preferencias.moneda}
            umbralDias={preferencias.diasProximoVencimiento}
          />
        </Modal>
      )}

      {mostrarMigracion && (
        <MigratePrompt
          onMigrar={handleMigrarDesdePrompt}
          onDescartar={handleDescartarMigracion}
          migrando={migrando}
          error={errorMigracion}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
