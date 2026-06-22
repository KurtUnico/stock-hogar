// Capa de notificaciones. Hoy dispara notificaciones LOCALES (simuladas),
// pero está escrita para que el día de mañana, cuando exista un backend con
// push real (VAPID + service worker `push` event), solo haya que agregar
// la suscripción acá adentro sin tocar el resto de la app.

export function soportaNotificaciones() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function pedirPermiso() {
  if (!soportaNotificaciones()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const resultado = await Notification.requestPermission();
  return resultado;
}

export function permisoActual() {
  if (!soportaNotificaciones()) return 'unsupported';
  return Notification.permission;
}

// Dispara una notificación local a través del service worker.
// Es el mismo mecanismo visual que tendría un push real; solo cambia
// quién la origina (el propio cliente, en vez de un servidor).
export async function mostrarNotificacionLocal(titulo, cuerpo) {
  if (permisoActual() !== 'granted') return false;
  try {
    const registro = await navigator.serviceWorker.ready;
    await registro.showNotification(titulo, {
      body: cuerpo,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg'
    });
    return true;
  } catch (err) {
    console.warn('No se pudo mostrar la notificación', err);
    return false;
  }
}

/* Preparado para más adelante:
export async function suscribirAPushReal(vapidPublicKey) {
  const registro = await navigator.serviceWorker.ready;
  const subscription = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey
  });
  // Acá se mandaría `subscription` al backend para guardarla.
  return subscription;
}
*/
