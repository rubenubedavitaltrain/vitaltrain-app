import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Suscripciones de WooCommerce (núcleo, migración 0024).
// WooCommerce avisa de pagos, pausas y cancelaciones. La app solo PROPONE; Rubén aplica cada cambio con un botón.
// - CambiosSuscripcion: en el Inicio del coach, solo si hay algo que hacer.
// - PlanesWoo: en Ajustes, qué módulos abre cada producto de WooCommerce.

type Cambio = { patient_id: string | null; nombre: string | null; email: string; planes: string | null; activar: string[]; desactivar: string[]; sin_cuenta: boolean };
type Modulo = { slug: string; name: string };
type Plan = { woo_product_id: number; plan: string; modules: string[] };

function useModulos(supabase: SupabaseClient) {
  const [mods, setMods] = useState<Modulo[]>([]);
  useEffect(() => { supabase.from('modules').select('slug, name').order('name').then(({ data }) => setMods((data as Modulo[]) ?? [])); }, [supabase]);
  return mods;
}

export function CambiosSuscripcion({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Cambio[]>([]);
  const [estado, setEstado] = useState('');
  const mods = useModulos(supabase);
  const nombreMod = (s: string) => mods.find((m) => m.slug === s)?.name ?? s;

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('cambios_suscripcion');
    setLista((data as Cambio[]) ?? []);
  }, [supabase]);
  useEffect(() => { cargar(); }, [cargar]);

  async function aplicar(c: Cambio) {
    const partes = [
      c.activar.length ? `Abrir: ${c.activar.map(nombreMod).join(', ')}.` : '',
      c.desactivar.length ? `Cerrar: ${c.desactivar.map(nombreMod).join(', ')}. Sus datos se conservan; solo deja de verlos.` : '',
    ].filter(Boolean).join('\n');
    if (!window.confirm(`${c.nombre} · ${c.planes}\n\n${partes}\n\n¿Aplicar?`)) return;
    const { error } = await supabase.rpc('aplicar_cambio_suscripcion', { p_patient: c.patient_id });
    setEstado(error ? `No se ha aplicado: ${error.message}` : `Aplicado a ${c.nombre}.`);
    cargar();
  }

  if (!lista.length && !estado) return null;
  const conCuenta = lista.filter((c) => !c.sin_cuenta);
  const sinCuenta = lista.filter((c) => c.sin_cuenta);
  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3 border-l-4 border-petroleo" aria-labelledby="suscripciones">
      <h3 id="suscripciones" className="text-lg font-bold">Suscripciones: cambios por revisar</h3>
      <p className="text-sm text-texto-suave">WooCommerce ha avisado de pagos, pausas o cancelaciones. No se cambia nada hasta que lo apliques tú.</p>
      {conCuenta.map((c) => (
        <div key={c.patient_id} className="flex flex-wrap items-center gap-3 border-t border-gris-claro pt-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{c.nombre} <span className="font-normal text-texto-suave">· {c.planes}</span></p>
            {c.activar.length > 0 && <p className="text-sm">Abrir: {c.activar.map(nombreMod).join(', ')}</p>}
            {c.desactivar.length > 0 && <p className="text-sm">Cerrar: {c.desactivar.map(nombreMod).join(', ')} <span className="text-texto-suave">(sus datos se conservan)</span></p>}
          </div>
          <button onClick={() => aplicar(c)} className="bg-petroleo text-white font-bold px-4 py-2 rounded-xl">Aplicar</button>
        </div>
      ))}
      {sinCuenta.length > 0 && (
        <div className="border-t border-gris-claro pt-3 flex flex-col gap-1">
          <p className="font-semibold">Han pagado y aún no tienen cuenta en la app</p>
          {sinCuenta.map((c) => <p key={c.email} className="text-sm">{c.email} · {c.planes}</p>)}
          <p className="text-sm text-texto-suave">Si quieres darles acceso, dales de alta en Pacientes con ese email. Después aparecerán aquí para abrirles su plan.</p>
        </div>
      )}
      {estado && <p role="status" className="font-semibold text-petroleo">{estado}</p>}
    </section>
  );
}

export function PlanesWoo({ supabase }: { supabase: SupabaseClient }) {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [nuevo, setNuevo] = useState({ id: '', plan: '' });
  const [error, setError] = useState('');
  const mods = useModulos(supabase);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('plan_products').select('woo_product_id, plan, modules').order('plan');
    setPlanes((data as Plan[]) ?? []);
  }, [supabase]);
  useEffect(() => { cargar(); }, [cargar]);

  async function cambiar(p: Plan, slug: string, on: boolean) {
    setError('');
    const modules = on ? [...p.modules, slug] : p.modules.filter((m) => m !== slug);
    const { error } = await supabase.from('plan_products').update({ modules }).eq('woo_product_id', p.woo_product_id);
    if (error) setError('No se ha podido guardar.');
    cargar();
  }

  async function añadir() {
    setError('');
    const id = Number(nuevo.id);
    if (!Number.isInteger(id) || id <= 0 || !nuevo.plan.trim()) return setError('Pon el número del producto de WooCommerce y un nombre.');
    const { error } = await supabase.from('plan_products').insert({ woo_product_id: id, plan: nuevo.plan.trim(), modules: [] });
    if (error) return setError('No se ha podido añadir. ¿Ese producto ya está?');
    setNuevo({ id: '', plan: '' });
    cargar();
  }

  return (
    <section className="bg-white rounded-2xl p-5 flex flex-col gap-3 max-w-3xl" aria-labelledby="planes-woo">
      <div>
        <h3 id="planes-woo" className="text-lg font-bold">Planes de WooCommerce</h3>
        <p className="text-sm text-texto-suave">Qué abre en la app cada producto de suscripción. Cambiarlo aquí no toca a ningún paciente: solo cambia lo que se te propone en Inicio.</p>
      </div>
      {planes.map((p) => (
        <div key={p.woo_product_id} className="border-t border-gris-claro pt-3">
          <p className="font-semibold">{p.plan} <span className="font-normal text-texto-suave">· producto {p.woo_product_id}</span></p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {mods.map((m) => (
              <label key={m.slug} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={p.modules.includes(m.slug)} onChange={(e) => cambiar(p, m.slug, e.target.checked)} className="w-4 h-4 accent-[#374949]" />
                {m.name}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="border-t border-gris-claro pt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm font-semibold">Nº de producto
          <input inputMode="numeric" value={nuevo.id} onChange={(e) => setNuevo({ ...nuevo, id: e.target.value.replace(/\D/g, '') })} className="w-32 px-3 py-2 border border-borde rounded-xl font-normal" />
        </label>
        <label className="flex flex-col text-sm font-semibold flex-1 min-w-[10rem]">Nombre del plan
          <input value={nuevo.plan} onChange={(e) => setNuevo({ ...nuevo, plan: e.target.value })} className="px-3 py-2 border border-borde rounded-xl font-normal" />
        </label>
        <button onClick={añadir} className="bg-petroleo text-white font-bold px-4 py-2 rounded-xl">Añadir</button>
      </div>
      {error && <p role="alert" className="font-semibold text-[#8A2C1D]">{error}</p>}
    </section>
  );
}
