import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import PanelSolar from '../../core/sol/PanelSolar';
import { aHoras, cargarAjustes, cargarComidas, cargarNoches, NOMBRE_CRONOTIPO, resumenComidas, resumenSueno, type Ajustes, type Comida, type Noche } from './datos';
import { ComidasDelDia, RegistroComida, RegistroSueno, nochePorDefecto } from './Registros';
import { GraficaComidas, GraficaNoches } from './Graficas';
import { diaSolar, horaMin } from '../../core/sol/sol';
import MiDia from './MiDia';
import { conUbicacionLocal, ElegirCiudad } from '../../core/sol/Ciudad';

// Módulo de ritmos circadianos.
// - TarjetaRitmo: lo que aporta a "Hoy" (luz del día y registro rápido de sueño y comidas).
// - MiRitmo: pantalla completa del paciente.
// - RitmoCoach: sección de la ficha del paciente en el panel del coach.

function useDatos(supabase: SupabaseClient, pacienteId: string) {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [noches, setNoches] = useState<Noche[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    // En el móvil del paciente, si activó su ubicación actual, manda sobre la ciudad (no se guarda en el servidor)
    cargarAjustes(supabase, pacienteId).then((a) => setAjustes(conUbicacionLocal(a, pacienteId)));
    cargarNoches(supabase, pacienteId, 30).then(setNoches);
    cargarComidas(supabase, pacienteId, 14).then(setComidas);
  }, [supabase, pacienteId, version]);
  return { ajustes, noches, comidas, recargar: () => setVersion((v) => v + 1) };
}

export function TarjetaRitmo({ supabase, pacienteId, onAbrir }: { supabase: SupabaseClient; pacienteId: string; onAbrir: () => void }) {
  const { ajustes, noches, recargar } = useDatos(supabase, pacienteId);
  const [hoja, setHoja] = useState<'sueno' | 'comida' | null>(null);
  if (!ajustes) return null;
  const d = ajustes.latitude != null && ajustes.longitude != null ? diaSolar(new Date(), ajustes.latitude, ajustes.longitude) : null;
  const anotada = noches.some((n) => n.night_of === nochePorDefecto());
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3" aria-labelledby="ritmo-hoy">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="ritmo-hoy" className="text-xs font-bold tracking-wide text-texto-suave">RITMOS CIRCADIANOS</h2>
          <p className="font-bold text-lg leading-tight mt-0.5">Tu luz de hoy</p>
        </div>
        <button onClick={onAbrir} className="text-petroleo font-bold text-sm py-1">Ver más ›</button>
      </div>
      {d ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini titulo="Amanecer" valor={horaMin(d.amanecer)} />
          <Mini titulo="UVB" valor={d.uvb ? `${horaMin(d.uvb.desde)}–${horaMin(d.uvb.hasta)}` : 'No hay'} />
          <Mini titulo="Atardecer" valor={horaMin(d.atardecer)} />
        </div>
      ) : (
        <button onClick={onAbrir} className="text-left text-sm bg-fondo rounded-xl p-3">Elige tu ciudad para ver el amanecer, el atardecer y las ventanas de luz de cada día.</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setHoja('sueno')} className={`py-3 rounded-xl font-bold ${anotada ? 'bg-fondo text-petroleo' : 'bg-mostaza text-[#1F2424]'}`}>{anotada ? 'Sueño anotado ✓' : 'Anotar sueño'}</button>
        <button onClick={() => setHoja('comida')} className="py-3 rounded-xl font-bold bg-fondo text-petroleo">Anotar comida</button>
      </div>
      {hoja === 'sueno' && <RegistroSueno supabase={supabase} pacienteId={pacienteId} previas={noches} workdays={ajustes.workdays} onCerrar={() => setHoja(null)} onHecho={() => { setHoja(null); recargar(); }} />}
      {hoja === 'comida' && <RegistroComida supabase={supabase} pacienteId={pacienteId} onCerrar={() => setHoja(null)} onHecho={() => { setHoja(null); recargar(); }} />}
    </section>
  );
}

export function MiRitmo({ supabase, pacienteId, onSalir }: { supabase: SupabaseClient; pacienteId: string; onSalir: () => void }) {
  const { ajustes, noches, comidas, recargar } = useDatos(supabase, pacienteId);
  const [hoja, setHoja] = useState<'sueno' | 'comida' | 'ciudad' | null>(null);
  const sueno = resumenSueno(noches.filter((n) => Date.now() - new Date(`${n.night_of}T12:00:00`).valueOf() < 14 * 86400000));
  const tieneCiudad = ajustes?.latitude != null && ajustes?.longitude != null;

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-petroleo text-white px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-6">
        <button onClick={onSalir} className="text-[#E3E8E8] font-semibold mb-3">← Volver</button>
        <h1 className="text-2xl font-bold">Mi ritmo</h1>
        <p className="text-[#E3E8E8] text-sm mt-1">Tu biología funciona por horarios. Respetarlos ordena todo lo demás.</p>
      </header>
      <main className="p-4 flex flex-col gap-4 pb-10">
        {!ajustes && <p className="text-texto-suave">Cargando…</p>}
        {ajustes && !tieneCiudad && (
          <section className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="font-bold">¿Dónde vives?</h2>
            <p className="text-sm text-texto-suave">Con tu ciudad calculamos el amanecer, el atardecer y las horas de luz útil de cada día. No usamos tu ubicación.</p>
            <button onClick={() => setHoja('ciudad')} className="bg-mostaza text-[#1F2424] font-bold py-3 rounded-xl">Elegir dónde estoy</button>
          </section>
        )}
        {ajustes && tieneCiudad && (
          <>
            <PanelSolar ciudad={ajustes.city ?? ''} lat={ajustes.latitude!} lon={ajustes.longitude!} />
            <button onClick={() => setHoja('ciudad')} className="self-start text-sm font-semibold text-petroleo -mt-2 px-1">Cambiar ciudad ({ajustes.city})</button>
            {ajustes.chronotype && <p className="text-sm text-texto-suave px-1 -mt-2">Tu cronotipo: <b className="text-texto">{NOMBRE_CRONOTIPO[ajustes.chronotype]}</b>.</p>}
          </>
        )}

        {ajustes && (
          <>
            <MiDia supabase={supabase} pacienteId={pacienteId} ajustes={ajustes} noches={noches} comidas={comidas} />
            <section className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3" aria-labelledby="sueno">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="sueno" className="font-bold">Mi sueño</h2>
                  <p className="text-xs text-texto-suave">Lo que importa es la regularidad: acostarte y levantarte a horas parecidas, también el fin de semana.</p>
                </div>
                <button onClick={() => setHoja('sueno')} className="shrink-0 bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-xl">Anotar</button>
              </div>
              {sueno.noches > 0 && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini titulo="Duermes" valor={sueno.duracionMedia != null ? aHoras(sueno.duracionMedia).replace(' min', '') : '—'} />
                  <Mini titulo="Te acuestas" valor={sueno.acostarseMedio ?? '—'} />
                  <Mini titulo="Te levantas" valor={sueno.levantarseMedio ?? '—'} />
                </div>
              )}
              {sueno.noches > 0 && <p className="text-xs text-texto-suave -mt-1">Media de las últimas 2 semanas ({sueno.noches} {sueno.noches === 1 ? 'noche' : 'noches'}).</p>}
              <GraficaNoches noches={noches} />
            </section>

            <section className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3" aria-labelledby="comidas">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="comidas" className="font-bold">Mis horarios de comida</h2>
                  <p className="text-xs text-texto-suave">Solo la hora. Tu digestión también tiene horario: comer de día y cenar lejos de dormir ayuda a que todo encaje.</p>
                </div>
                <button onClick={() => setHoja('comida')} className="shrink-0 bg-mostaza text-[#1F2424] font-bold px-4 py-2.5 rounded-xl">Anotar</button>
              </div>
              <ComidasDelDia supabase={supabase} comidas={comidas} onCambio={recargar} />
              <GraficaComidas comidas={comidas} />
            </section>
          </>
        )}
      </main>

      {hoja === 'sueno' && ajustes && <RegistroSueno supabase={supabase} pacienteId={pacienteId} previas={noches} workdays={ajustes.workdays} onCerrar={() => setHoja(null)} onHecho={() => { setHoja(null); recargar(); }} />}
      {hoja === 'comida' && <RegistroComida supabase={supabase} pacienteId={pacienteId} onCerrar={() => setHoja(null)} onHecho={() => { setHoja(null); recargar(); }} />}
      {hoja === 'ciudad' && <ElegirCiudad supabase={supabase} pacienteId={pacienteId} actual={ajustes?.city ?? null} onCerrar={() => setHoja(null)} onHecho={() => { setHoja(null); recargar(); }} />}
    </div>
  );
}

export function RitmoCoach({ supabase, pacienteId }: { supabase: SupabaseClient; pacienteId: string }) {
  const { ajustes, noches, comidas, recargar } = useDatos(supabase, pacienteId);
  const [hoja, setHoja] = useState<'ciudad' | 'sueno' | null>(null);
  const s = resumenSueno(noches);
  const c = resumenComidas(comidas, noches);
  const min = (m: number | null) => (m == null ? '—' : m < 60 ? `${Math.round(m)} min` : aHoras(m));
  const escala = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} / 5`);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="ritmo-coach">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h3 id="ritmo-coach" className="text-lg font-bold">Ritmos circadianos</h3>
        <p className="text-sm text-texto-suave">
          {ajustes?.city ? `Ciudad: ${ajustes.city}` : 'Sin ciudad'} · <button onClick={() => setHoja('ciudad')} className="font-semibold text-petroleo">{ajustes?.city ? 'cambiar' : 'elegir'}</button>
          {' · '}{ajustes?.chronotype ? `Cronotipo ${NOMBRE_CRONOTIPO[ajustes.chronotype]} (${ajustes.chronotype_score})` : 'Cronotipo sin medir'}
          {' · '}<button onClick={() => setHoja('sueno')} className="font-semibold text-petroleo">anotar una noche</button>
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Indicador titulo="Noches anotadas (30 días)" valor={String(s.noches)} />
        <Indicador titulo="Sueño medio" valor={min(s.duracionMedia)} nota="En cama menos latencia" />
        <Indicador titulo="Se acuesta / levanta" valor={`${s.acostarseMedio ?? '—'} / ${s.levantarseMedio ?? '—'}`} />
        <Indicador titulo="Regularidad" valor={s.regularidadAcostarse != null ? `± ${Math.round(s.regularidadAcostarse)} / ± ${Math.round(s.regularidadLevantarse!)} min` : '—'} nota="Variación al acostarse / levantarse" />
        <Indicador titulo="Jet lag social" valor={min(s.jetLagSocial)} nota="Punto medio del sueño, libres vs laborables" />
        <Indicador titulo="Calidad / descanso" valor={`${escala(s.calidadMedia)} · ${escala(s.descansoMedio)}`} />
        <Indicador titulo="Ventana de alimentación" valor={min(c.ventanaMedia)} nota={c.primeraMedia ? `De ${c.primeraMedia} a ${c.ultimaMedia} (media, ${c.dias} días)` : 'Sin días con 2+ comidas'} />
        <Indicador titulo="Última comida → cama" valor={min(c.ultimaAntesDeDormir)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-2"><h4 className="font-bold">Noches (14 días)</h4><GraficaNoches noches={noches} /></div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-2"><h4 className="font-bold">Comidas (14 días)</h4><GraficaComidas comidas={comidas} /></div>
      </div>
      {ajustes?.latitude != null && ajustes?.longitude != null && (
        <div className="grid lg:grid-cols-2 gap-4"><PanelSolar ciudad={ajustes.city ?? ''} lat={ajustes.latitude} lon={ajustes.longitude} compacto /></div>
      )}
      {hoja === 'ciudad' && <ElegirCiudad supabase={supabase} pacienteId={pacienteId} actual={ajustes?.city ?? null} onCerrar={() => setHoja(null)} onHecho={() => { setHoja(null); recargar(); }} />}
      {hoja === 'sueno' && ajustes && <RegistroSueno supabase={supabase} pacienteId={pacienteId} previas={noches} workdays={ajustes.workdays} onCerrar={() => setHoja(null)} onHecho={() => { setHoja(null); recargar(); }} />}
    </section>
  );
}

function Mini({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-fondo p-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-texto-suave">{titulo}</div>
      <div className="font-bold tabular-nums">{valor}</div>
    </div>
  );
}

function Indicador({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="bg-white rounded-2xl p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-texto-suave">{titulo}</div>
      <div className="text-lg font-bold tabular-nums leading-tight mt-0.5">{valor}</div>
      {nota && <div className="text-[11px] text-texto-suave leading-snug mt-0.5">{nota}</div>}
    </div>
  );
}
