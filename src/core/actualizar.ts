import { registerSW } from 'virtual:pwa-register';

// Actualización de la app instalada.
// En iPhone, la app de la pantalla de inicio casi nunca se «abre» de cero: vuelve de segundo plano.
// Por eso, además de al abrirla, se busca versión nueva cada vez que vuelve a primer plano y cada 30 minutos.
// Si hay versión nueva, se instala y la página se recarga sola. Nunca durante un entrenamiento abierto.

let registro: ServiceWorkerRegistration | undefined;
let pausado = false;

export function pausarActualizacion(p: boolean) { pausado = p; }

function buscar() {
  if (!registro || pausado || document.visibilityState !== 'visible' || !navigator.onLine) return;
  registro.update().catch(() => { /* sin conexión: se intentará luego */ });
}

export function iniciarActualizacion() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      registro = r;
      document.addEventListener('visibilitychange', buscar);
      window.addEventListener('focus', buscar);
      setInterval(buscar, 30 * 60 * 1000);
    },
  });
}

/** Botón «Buscar actualización». Devuelve true si se ha encontrado una versión nueva (la página se recargará). */
export async function buscarAhora(): Promise<boolean | null> {
  if (!registro) return null;
  try {
    await registro.update();
    return !!(registro.installing || registro.waiting);
  } catch { return null; }
}
