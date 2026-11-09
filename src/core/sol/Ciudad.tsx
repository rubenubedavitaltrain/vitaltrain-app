import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CIUDADES } from './ciudades';
import { Hoja } from '../ui/Hoja';

// Ciudad del paciente (núcleo): la usan el módulo «sol» y el de ritmos circadianos.
// Se guarda en patient_settings la ciudad elegida de una lista.
// Opción «Usar mi ubicación actual»: la posición del móvil (redondeada a ~1 km) se guarda SOLO en ese móvil
// (localStorage, se borra al cerrar sesión). Nunca se envía al servidor. Así el sol se calcula con el dato real
// sin recoger la ubicación del paciente.

export type CiudadPaciente = { city: string | null; latitude: number | null; longitude: number | null };

export type UbicacionLocal = { lat: number; lon: number; fecha: string };
const claveUbicacion = (paciente: string) => `vt.${paciente}.ubicacion`;

export function leerUbicacionLocal(paciente: string): UbicacionLocal | null {
  try {
    const u = JSON.parse(localStorage.getItem(claveUbicacion(paciente)) ?? 'null') as UbicacionLocal | null;
    return u && Number.isFinite(u.lat) && Number.isFinite(u.lon) ? u : null;
  } catch { return null; }
}

export function borrarUbicacionLocal(paciente: string) {
  try { localStorage.removeItem(claveUbicacion(paciente)); } catch { /* sin almacenamiento */ }
}

/** Pide la posición al móvil y la guarda solo en él, redondeada a dos decimales (unos 1 km). */
export function pedirUbicacionLocal(paciente: string): Promise<UbicacionLocal> {
  return new Promise((ok, mal) => {
    if (!('geolocation' in navigator)) return mal(new Error('Este móvil no permite saber la ubicación.'));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const u = { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, fecha: new Date().toISOString() };
        try { localStorage.setItem(claveUbicacion(paciente), JSON.stringify(u)); } catch { /* sin almacenamiento */ }
        ok(u);
      },
      (e) => mal(new Error(e.code === e.PERMISSION_DENIED ? 'No has dado permiso para usar la ubicación. Puedes darlo en los ajustes del móvil.' : 'No se ha podido saber la ubicación. Prueba otra vez al aire libre.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** Si en este móvil hay ubicación actual guardada, manda sobre la ciudad. */
export function conUbicacionLocal<T extends CiudadPaciente>(c: T, paciente: string): T & { gps: boolean } {
  const u = leerUbicacionLocal(paciente);
  return u ? { ...c, city: 'tu ubicación actual', latitude: u.lat, longitude: u.lon, gps: true } : { ...c, gps: false };
}

export async function cargarCiudad(supabase: SupabaseClient, paciente: string): Promise<CiudadPaciente> {
  const { data } = await supabase.from('patient_settings').select('city, latitude, longitude').eq('patient_id', paciente).maybeSingle();
  const d = data as CiudadPaciente | null;
  return { city: d?.city ?? null, latitude: d?.latitude == null ? null : Number(d.latitude), longitude: d?.longitude == null ? null : Number(d.longitude) };
}

/** Lo que usa el paciente en su móvil: su ubicación actual si la activó; si no, su ciudad. */
export async function cargarLugar(supabase: SupabaseClient, paciente: string) {
  return conUbicacionLocal(await cargarCiudad(supabase, paciente), paciente);
}

export async function guardarCiudad(supabase: SupabaseClient, paciente: string, c: { nombre: string; lat: number; lon: number }) {
  return supabase.from('patient_settings').upsert({ patient_id: paciente, city: c.nombre, latitude: c.lat, longitude: c.lon }, { onConflict: 'patient_id' });
}


export function ElegirCiudad({ supabase, pacienteId, actual, onCerrar, onHecho }: { supabase: SupabaseClient; pacienteId: string; actual: string | null; onCerrar: () => void; onHecho: () => void }) {
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  const gps = leerUbicacionLocal(pacienteId);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = CIUDADES.filter((c) => norm(c.nombre).includes(norm(buscar)));
  return (
    <Hoja titulo="Dónde estás" onCerrar={onCerrar}>
            <div className="bg-white rounded-xl p-3 flex flex-col gap-2">
        <button
          onClick={async () => { setError(''); setBuscando(true); try { await pedirUbicacionLocal(pacienteId); onHecho(); } catch (e) { setError((e as Error).message); } finally { setBuscando(false); } }}
          disabled={buscando} className="bg-petroleo text-white font-bold py-3 rounded-xl disabled:opacity-60"
        >
          {buscando ? 'Buscando…' : gps ? 'Actualizar mi ubicación actual' : 'Usar mi ubicación actual'}
        </button>
        <p className="text-xs text-texto-suave">Da la hora exacta del sol donde estás. Tu ubicación se queda solo en este móvil: no se envía ni se guarda en ningún servidor.</p>
        {gps && <button onClick={() => { borrarUbicacionLocal(pacienteId); onHecho(); }} className="self-start text-sm font-semibold text-petroleo">Dejar de usarla y volver a la ciudad</button>}
      </div>
      <p className="text-sm font-semibold -mb-2">O elige una ciudad <span className="font-normal text-texto-suave">(la más cercana; unos kilómetros apenas cambian el resultado)</span></p>
      <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar" className="text-base px-3 py-2.5 border border-borde rounded-xl bg-white" />
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
      <ul className="flex flex-col max-h-[45dvh] overflow-y-auto bg-white rounded-xl">
        {lista.map((c) => (
          <li key={c.nombre}>
            <button
              onClick={async () => { const { error } = await guardarCiudad(supabase, pacienteId, c); if (error) setError('No se ha podido guardar.'); else { borrarUbicacionLocal(pacienteId); onHecho(); } }}
              className={`w-full text-left px-4 py-3 border-b border-fondo ${c.nombre === actual ? 'font-bold text-petroleo' : ''}`}
            >
              {c.nombre}{c.nombre === actual ? ' ✓' : ''}
            </button>
          </li>
        ))}
        {lista.length === 0 && <li className="px-4 py-3 text-sm text-texto-suave">No está en la lista. Elige la ciudad más cercana o pide a Rubén que la añada.</li>}
      </ul>
    </Hoja>
  );
}

