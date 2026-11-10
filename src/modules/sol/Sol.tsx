import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import PanelSolar from '../../core/sol/PanelSolar';
import { cargarLugar, ElegirCiudad, type CiudadPaciente } from '../../core/sol/Ciudad';
import { diaSolar, horaMin } from '../../core/sol/sol';

// Módulo «sol» (plan gratuito Ritmo, pilar Contacto con la naturaleza).
// Panel solar de la ciudad y ventana de vitamina D. No registra nada: todo se calcula en el móvil.
// - TarjetaSol: lo que aporta a «Hoy». No sale si el paciente tiene ritmos circadianos (ya lo incluye).
// - MiSol: pantalla completa.
// - SolCoach: sección de la ficha del coach (solo qué ciudad tiene elegida).

function useCiudad(supabase: SupabaseClient, pacienteId: string) {
  const [c, setC] = useState<(CiudadPaciente & { gps: boolean }) | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => { cargarLugar(supabase, pacienteId).then(setC); }, [supabase, pacienteId, v]);
  return { ciudad: c, recargar: () => setV((x) => x + 1) };
}

export function TarjetaSol({ supabase, pacienteId, onAbrir }: { supabase: SupabaseClient; pacienteId: string; onAbrir: () => void }) {
  const { ciudad } = useCiudad(supabase, pacienteId);
  if (!ciudad) return null;
  const d = ciudad.latitude != null && ciudad.longitude != null ? diaSolar(new Date(), ciudad.latitude, ciudad.longitude) : null;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="sol-hoy">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="sol-hoy" className="text-xs font-bold tracking-wide text-texto-suave">SOL Y VITAMINA D</h2>
          <p className="font-bold text-lg leading-tight mt-0.5">{ciudad.gps ? 'El sol de hoy donde estás' : ciudad.city ? `El sol de hoy en ${ciudad.city}` : 'Tu sol de hoy'}</p>
        </div>
        <button onClick={onAbrir} className="text-petroleo font-bold text-sm py-1">Ver más ›</button>
      </div>
      {d ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini titulo="Amanecer" valor={horaMin(d.amanecer)} />
          <Mini titulo="Vitamina D" valor={d.uvb ? `${horaMin(d.uvb.desde)}–${horaMin(d.uvb.hasta)}` : 'Hoy no'} />
          <Mini titulo="Atardecer" valor={horaMin(d.atardecer)} />
        </div>
      ) : (
        <button onClick={onAbrir} className="text-left text-sm bg-fondo rounded-xl p-3">Elige tu ciudad para ver el amanecer, el atardecer y la ventana de vitamina D de cada día.</button>
      )}
    </section>
  );
}

export function MiSol({ supabase, pacienteId, onSalir }: { supabase: SupabaseClient; pacienteId: string; onSalir: () => void }) {
  const { ciudad, recargar } = useCiudad(supabase, pacienteId);
  const [elegir, setElegir] = useState(false);
  const hay = ciudad?.latitude != null && ciudad?.longitude != null;
  return (
    <div className="min-h-full flex flex-col bg-fondo">
      <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-5">
        <button onClick={onSalir} className="text-[#E3E8E8] font-semibold mb-2">← Hoy</button>
        <h1 className="text-2xl font-bold">Sol y vitamina D</h1>
        <p className="text-[#E3E8E8] text-sm mt-1">Sol, tierra y aire libre: los estímulos con los que evolucionó tu cuerpo.</p>
      </header>
      <main className="p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] flex flex-col gap-4">
        {!ciudad ? <p className="text-texto-suave">Cargando…</p> : !hay ? (
          <section className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <p>Usa tu ubicación actual o elige tu ciudad. Con ella se calculan el amanecer, el atardecer y la ventana de vitamina D de cada día.</p>
            <button onClick={() => setElegir(true)} className="bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl">Elegir dónde estoy</button>
          </section>
        ) : (
          <>
            <PanelSolar ciudad={ciudad.city ?? ''} lat={ciudad.latitude!} lon={ciudad.longitude!} />
            <button onClick={() => setElegir(true)} className="self-start text-sm font-semibold text-petroleo px-1">{ciudad.gps ? 'Usando tu ubicación actual · cambiar' : `Cambiar ciudad (${ciudad.city})`}</button>
          </>
        )}
      </main>
      {elegir && <ElegirCiudad supabase={supabase} pacienteId={pacienteId} actual={ciudad?.city ?? null} onCerrar={() => setElegir(false)} onHecho={() => { setElegir(false); recargar(); }} />}
    </div>
  );
}

export function SolCoach({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const { ciudad } = useCiudad(supabase, pacienteId);
  if (!ciudad) return null;
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-1" aria-labelledby="sol-coach">
      <h3 id="sol-coach" className="text-lg font-bold">Sol y vitamina D</h3>
      <p className="text-sm text-texto-suave">{ciudad.city ? `Ciudad elegida: ${ciudad.city}. Ve su panel solar y su ventana de vitamina D.` : 'Aún no ha elegido ciudad.'} Este módulo no registra datos.</p>
    </section>
  );
}

function Mini({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-fondo rounded-xl py-2.5 px-1">
      <p className="text-xs text-texto-suave">{titulo}</p>
      <p className="font-bold tabular-nums text-sm leading-tight mt-0.5">{valor}</p>
    </div>
  );
}
