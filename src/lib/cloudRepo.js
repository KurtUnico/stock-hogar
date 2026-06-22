import { supabase } from './supabaseClient';
import { DEFAULT_CATEGORIES } from '../data/categories';

// =========================================================================
// Capa de datos en la nube. Cada función espeja una operación que la app ya
// hace contra localStorage (ver utils/storage.js), pero contra Supabase.
// Acá vive TODO el mapeo entre la forma "camelCase" que usa el resto de la
// app (heredada del modelo local) y las columnas "snake_case" de Postgres,
// para que App.jsx no tenga que pensar en eso.
//
// Estrategia de sync (simple a propósito, ver README/SUPABASE_SETUP.md):
//  - Productos / categorías / settings / compra activa: se sobrescriben
//    "como vienen" (upsert) cada vez que cambian localmente.
//  - Lista de compras manual: se reemplaza completa (delete + insert) cada
//    vez; son pocas filas, no vale la pena diffear.
//  - Historial de compras y eventos de stock: son logs append-only, así que
//    solo se insertan los registros NUEVOS, nunca se reescriben los viejos.
// =========================================================================

function chequearCliente() {
  if (!supabase) {
    throw new Error('Supabase no está configurado (faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
}

// ---------------------------------------------------------------------
// Hogar: resuelve el household_id del usuario logueado. El trigger
// handle_new_user() ya debería haberlo creado al registrarse; el fallback
// de acá abajo es solo por las dudas (trigger que no corrió, usuario viejo
// migrado a mano a auth.users, etc.).
// ---------------------------------------------------------------------
export async function resolverHogar(userId) {
  chequearCliente();
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.household_id) return data.household_id;
  return crearHogarPorDefecto(userId);
}

async function crearHogarPorDefecto(userId) {
  const { data: hogar, error: errHogar } = await supabase
    .from('households')
    .insert({ name: 'Mi hogar', created_by: userId })
    .select('id')
    .single();
  if (errHogar) throw errHogar;

  const { error: errMiembro } = await supabase
    .from('household_members')
    .insert({ household_id: hogar.id, user_id: userId, role: 'owner' });
  if (errMiembro) throw errMiembro;

  await supabase.from('settings').insert({ household_id: hogar.id });
  await supabase
    .from('categories')
    .insert(DEFAULT_CATEGORIES.map((nombre) => ({ household_id: hogar.id, nombre })));

  return hogar.id;
}

// ---------------------------------------------------------------------
// Mapeos JS (camelCase) <-> fila de Postgres (snake_case)
// ---------------------------------------------------------------------
const productoARow = (householdId, p) => ({
  id: p.id,
  household_id: householdId,
  nombre: p.nombre,
  categoria: p.categoria,
  unidad: p.unidad,
  stock_minimo: Number(p.stockMinimo) || 0,
  notificacion_activa: Boolean(p.notificacionActiva),
  requiere_vencimiento: Boolean(p.requiereVencimiento),
  es_critico: Boolean(p.esCritico),
  ultima_actualizacion: p.ultimaActualizacion || new Date().toISOString()
});

const rowAProducto = (row) => ({
  id: row.id,
  nombre: row.nombre,
  categoria: row.categoria,
  unidad: row.unidad,
  stockMinimo: Number(row.stock_minimo) || 0,
  notificacionActiva: row.notificacion_activa,
  requiereVencimiento: Boolean(row.requiere_vencimiento),
  esCritico: Boolean(row.es_critico),
  ultimaActualizacion: row.ultima_actualizacion
});

const loteARow = (householdId, l) => ({
  id: l.id,
  household_id: householdId,
  product_id: l.productId,
  ubicacion: l.ubicacion,
  cantidad: Number(l.cantidad) || 0,
  fecha_compra: l.fechaCompra || null,
  fecha_vencimiento: l.fechaVencimiento || null,
  precio_unitario: l.precioUnitario === null || l.precioUnitario === undefined ? null : Number(l.precioUnitario),
  observaciones: l.observaciones || null,
  activo: l.activo !== false,
  fecha_creacion: l.fechaCreacion || new Date().toISOString(),
  fecha_actualizacion: l.fechaActualizacion || new Date().toISOString()
});

const rowALote = (row) => ({
  id: row.id,
  productId: row.product_id,
  ubicacion: row.ubicacion,
  cantidad: Number(row.cantidad) || 0,
  fechaCompra: row.fecha_compra,
  fechaVencimiento: row.fecha_vencimiento,
  precioUnitario: row.precio_unitario === null ? null : Number(row.precio_unitario),
  observaciones: row.observaciones,
  activo: row.activo,
  fechaCreacion: row.fecha_creacion,
  fechaActualizacion: row.fecha_actualizacion
});

const manualARow = (householdId, m) => ({
  id: m.id,
  household_id: householdId,
  nombre: m.nombre,
  cantidad: Number(m.cantidad) || 1,
  comprado: Boolean(m.comprado)
});

const rowAManual = (row) => ({
  id: row.id,
  nombre: row.nombre,
  cantidad: Number(row.cantidad) || 1,
  comprado: row.comprado,
  manual: true
});

const eventoARow = (householdId, e) => ({
  id: e.id,
  household_id: householdId,
  producto_id: e.productoId,
  tipo: e.tipo,
  cantidad: Number(e.cantidad) || 0,
  fecha: e.fecha
});

const rowAEvento = (row) => ({
  id: row.id,
  productoId: row.producto_id,
  tipo: row.tipo,
  cantidad: Number(row.cantidad) || 0,
  fecha: row.fecha
});

// ---------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------
export async function cargarProductos(householdId) {
  chequearCliente();
  const { data, error } = await supabase.from('products').select('*').eq('household_id', householdId);
  if (error) throw error;
  return (data || []).map(rowAProducto);
}

export async function guardarProductos(householdId, productos) {
  chequearCliente();
  if (productos.length === 0) return;
  const filas = productos.map((p) => productoARow(householdId, p));
  const { error } = await supabase.from('products').upsert(filas, { onConflict: 'id' });
  if (error) throw error;
}

export async function eliminarProductoCloud(productId) {
  chequearCliente();
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Lotes (stock_items)
// ---------------------------------------------------------------------
export async function cargarLotes(householdId) {
  chequearCliente();
  const { data, error } = await supabase.from('stock_items').select('*').eq('household_id', householdId);
  if (error) throw error;
  return (data || []).map(rowALote);
}

export async function guardarLotes(householdId, lotes) {
  chequearCliente();
  if (lotes.length === 0) return;
  const filas = lotes.map((l) => loteARow(householdId, l));
  const { error } = await supabase.from('stock_items').upsert(filas, { onConflict: 'id' });
  if (error) throw error;
}

export async function eliminarLoteCloud(loteId) {
  chequearCliente();
  const { error } = await supabase.from('stock_items').delete().eq('id', loteId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------
export async function cargarCategorias(householdId) {
  chequearCliente();
  const { data, error } = await supabase
    .from('categories')
    .select('nombre')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => row.nombre);
}

export async function agregarCategoriaCloud(householdId, nombre) {
  chequearCliente();
  // Idempotente: si ya existe (unique household_id+nombre), no rompe nada.
  const { error } = await supabase
    .from('categories')
    .upsert({ household_id: householdId, nombre }, { onConflict: 'household_id,nombre', ignoreDuplicates: true });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Lista de compras manual (shopping_list_items)
// ---------------------------------------------------------------------
export async function cargarListaManual(householdId) {
  chequearCliente();
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowAManual);
}

// Reemplazo completo: simple y suficiente para la cantidad de filas que
// maneja esta tabla en la práctica (ver nota de estrategia arriba).
export async function reemplazarListaManual(householdId, items) {
  chequearCliente();
  const { error: errDelete } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('household_id', householdId);
  if (errDelete) throw errDelete;
  if (items.length === 0) return;
  const filas = items.map((m) => manualARow(householdId, m));
  const { error: errInsert } = await supabase.from('shopping_list_items').insert(filas);
  if (errInsert) throw errInsert;
}

// ---------------------------------------------------------------------
// Compra activa (a lo sumo 1 fila por hogar)
// ---------------------------------------------------------------------
export async function cargarCompraActiva(householdId) {
  chequearCliente();
  const { data, error } = await supabase
    .from('active_purchases')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { iniciadaEn: data.iniciada_en, items: data.items || [] };
}

export async function guardarCompraActiva(householdId, compra) {
  chequearCliente();
  if (!compra) {
    const { error } = await supabase.from('active_purchases').delete().eq('household_id', householdId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('active_purchases').upsert(
    {
      household_id: householdId,
      iniciada_en: compra.iniciadaEn,
      items: compra.items,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'household_id' }
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Historial de compras (append-only: solo se insertan registros nuevos)
// ---------------------------------------------------------------------
export async function cargarHistorial(householdId) {
  chequearCliente();
  const { data: compras, error: errCompras } = await supabase
    .from('purchase_history')
    .select('*')
    .eq('household_id', householdId)
    .order('fecha', { ascending: false });
  if (errCompras) throw errCompras;
  if (!compras || compras.length === 0) return [];

  const ids = compras.map((c) => c.id);
  const { data: items, error: errItems } = await supabase
    .from('purchase_history_items')
    .select('*')
    .in('purchase_id', ids);
  if (errItems) throw errItems;

  return compras.map((c) => ({
    id: c.id,
    fecha: c.fecha,
    total: Number(c.total) || 0,
    items: (items || [])
      .filter((it) => it.purchase_id === c.id)
      .map((it) => ({
        productoId: it.producto_id,
        nombre: it.nombre,
        categoria: it.categoria,
        cantidad: Number(it.cantidad) || 0,
        unidad: it.unidad,
        precioUnitario: Number(it.precio_unitario) || 0,
        subtotal: Number(it.subtotal) || 0
      }))
  }));
}

export async function insertarCompraCerrada(householdId, registro) {
  chequearCliente();
  const { error: errCompra } = await supabase.from('purchase_history').insert({
    id: registro.id,
    household_id: householdId,
    fecha: registro.fecha,
    total: registro.total
  });
  if (errCompra) throw errCompra;

  if (registro.items.length === 0) return;
  const filas = registro.items.map((it) => ({
    purchase_id: registro.id,
    producto_id: it.productoId,
    nombre: it.nombre,
    categoria: it.categoria,
    cantidad: it.cantidad,
    unidad: it.unidad,
    precio_unitario: it.precioUnitario,
    subtotal: it.subtotal
  }));
  const { error: errItems } = await supabase.from('purchase_history_items').insert(filas);
  if (errItems) throw errItems;
}

// ---------------------------------------------------------------------
// Eventos de stock (append-only)
// ---------------------------------------------------------------------
export async function cargarEventos(householdId) {
  chequearCliente();
  const { data, error } = await supabase
    .from('stock_events')
    .select('*')
    .eq('household_id', householdId)
    .order('fecha', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowAEvento);
}

export async function insertarEventos(householdId, eventos) {
  chequearCliente();
  if (eventos.length === 0) return;
  const filas = eventos.map((e) => eventoARow(householdId, e));
  const { error } = await supabase.from('stock_events').insert(filas);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Settings (presupuesto / moneda)
// ---------------------------------------------------------------------
export async function cargarPreferencias(householdId) {
  chequearCliente();
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
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
    };
  }
  // Booleanos: si la columna no existe todavía (proyecto Supabase sin
  // migrar), data.columna viene undefined -> ?? true cae al default
  // "activado", igual que el resto de la app cuando no hay preferencia
  // guardada.
  return {
    presupuestoMensual: Number(data.presupuesto_mensual) || 0,
    moneda: data.moneda || 'UYU',
    // Number(null) es 0, así que ojo: si la columna no existe en una fila vieja
    // (proyecto Supabase sin migrar todavía), caemos al default 30, no a 0.
    diasProximoVencimiento: Number.isFinite(Number(data.dias_proximo_vencimiento)) && data.dias_proximo_vencimiento !== null
      ? Number(data.dias_proximo_vencimiento)
      : 30,
    mostrarTranquilidadDashboard: data.mostrar_tranquilidad_dashboard ?? true,
    tranquilidadIncluyePrediccion: data.tranquilidad_incluye_prediccion ?? true,
    tranquilidadIncluyeVencimientos: data.tranquilidad_incluye_vencimientos ?? true,
    diasParaCompraProxima: Number.isFinite(Number(data.dias_para_compra_proxima)) && data.dias_para_compra_proxima !== null
      ? Number(data.dias_para_compra_proxima)
      : 14,
    voyAlSuperIncluyePrediccion: data.voy_al_super_incluye_prediccion ?? true,
    voyAlSuperIncluyeVencimientos: data.voy_al_super_incluye_vencimientos ?? true,
    voyAlSuperIncluyeCriticos: data.voy_al_super_incluye_criticos ?? true
  };
}

export async function guardarPreferenciasCloud(householdId, preferencias) {
  chequearCliente();
  const { error } = await supabase.from('settings').upsert(
    {
      household_id: householdId,
      presupuesto_mensual: Number(preferencias.presupuestoMensual) || 0,
      moneda: preferencias.moneda || 'UYU',
      dias_proximo_vencimiento: Number(preferencias.diasProximoVencimiento) || 30,
      mostrar_tranquilidad_dashboard: Boolean(preferencias.mostrarTranquilidadDashboard ?? true),
      tranquilidad_incluye_prediccion: Boolean(preferencias.tranquilidadIncluyePrediccion ?? true),
      tranquilidad_incluye_vencimientos: Boolean(preferencias.tranquilidadIncluyeVencimientos ?? true),
      dias_para_compra_proxima: Number(preferencias.diasParaCompraProxima) || 14,
      voy_al_super_incluye_prediccion: Boolean(preferencias.voyAlSuperIncluyePrediccion ?? true),
      voy_al_super_incluye_vencimientos: Boolean(preferencias.voyAlSuperIncluyeVencimientos ?? true),
      voy_al_super_incluye_criticos: Boolean(preferencias.voyAlSuperIncluyeCriticos ?? true),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'household_id' }
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Migración: flag en el propio hogar (autoridad real — sobrevive a que se
// pierda el flag local, por ejemplo si el usuario entra desde otro
// navegador o le borraron los datos del sitio).
// ---------------------------------------------------------------------
export async function yaSeMigroAlHogar(householdId) {
  chequearCliente();
  const { data, error } = await supabase
    .from('households')
    .select('migrated_from_local')
    .eq('id', householdId)
    .single();
  if (error) throw error;
  return Boolean(data?.migrated_from_local);
}

export async function marcarHogarComoMigrado(householdId) {
  chequearCliente();
  const { error } = await supabase
    .from('households')
    .update({ migrated_from_local: true })
    .eq('id', householdId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Carga completa (login / reconexión)
// ---------------------------------------------------------------------
export async function cargarTodo(householdId) {
  const [productos, categorias, manualItems, compraActiva, historialCompras, eventos, stockItems, preferencias] =
    await Promise.all([
      cargarProductos(householdId),
      cargarCategorias(householdId),
      cargarListaManual(householdId),
      cargarCompraActiva(householdId),
      cargarHistorial(householdId),
      cargarEventos(householdId),
      cargarLotes(householdId),
      cargarPreferencias(householdId)
    ]);
  return { productos, categorias, manualItems, compraActiva, historialCompras, eventos, stockItems, preferencias };
}
