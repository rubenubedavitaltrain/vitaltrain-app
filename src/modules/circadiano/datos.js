export const TIPOS_COMIDA = { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: 'Algo entre horas', other: 'Otra' };
export async function cargarAjustes(supabase, paciente) {
    const { data } = await supabase.from('patient_settings').select('city, latitude, longitude, workdays').eq('patient_id', paciente).maybeSingle();
    const d = data;
    return { city: d?.city ?? null, latitude: d?.latitude == null ? null : Number(d.latitude), longitude: d?.longitude == null ? null : Number(d.longitude), workdays: d?.workdays ?? [1, 2, 3, 4, 5] };
}
export async function guardarCiudad(supabase, paciente, c) {
    return supabase.from('patient_settings').upsert({ patient_id: paciente, city: c.nombre, latitude: c.lat, longitude: c.lon }, { onConflict: 'patient_id' });
}
export async function cargarNoches(supabase, paciente, dias = 30) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const { data } = await supabase.from('sleep_logs')
        .select('id, night_of, bedtime, wake_time, sleep_latency_minutes, awakenings, quality, rested, is_free_day, note')
        .eq('patient_id', paciente).gte('night_of', desde.toISOString().slice(0, 10)).order('night_of', { ascending: false });
    return data ?? [];
}
export async function cargarComidas(supabase, paciente, dias = 14) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);
    const { data } = await supabase.from('meal_events').select('id, eaten_at, kind, note').eq('patient_id', paciente).gte('eaten_at', desde.toISOString()).order('eaten_at');
    return data ?? [];
}
// ---------- Cálculos para el seguimiento ----------
const minutosDelDia = (iso, base = 12 * 60) => {
    // Minutos desde el mediodía anterior: así las 23:30 y la 01:00 quedan seguidas (690 y 780).
    const d = new Date(iso);
    let m = d.getHours() * 60 + d.getMinutes() - base;
    if (m < 0)
        m += 1440;
    return m;
};
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const desviacion = (xs) => { const m = media(xs); return Math.sqrt(media(xs.map((x) => (x - m) ** 2))); };
export const aHora = (minDesdeMediodia) => {
    const t = Math.round((minDesdeMediodia + 12 * 60) % 1440);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
export const aHoras = (min) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
export function resumenSueno(noches) {
    const completas = noches.filter((n) => n.bedtime && n.wake_time);
    const acostarse = completas.map((n) => minutosDelDia(n.bedtime));
    const levantarse = completas.map((n) => minutosDelDia(n.wake_time, 0));
    const duraciones = completas.map((n) => (new Date(n.wake_time).valueOf() - new Date(n.bedtime).valueOf()) / 60000 - (n.sleep_latency_minutes ?? 0));
    const puntoMedio = (n) => minutosDelDia(n.bedtime) + ((new Date(n.wake_time).valueOf() - new Date(n.bedtime).valueOf()) / 60000) / 2;
    const libres = completas.filter((n) => n.is_free_day === true).map(puntoMedio);
    const laborables = completas.filter((n) => n.is_free_day === false).map(puntoMedio);
    const q = noches.map((n) => n.quality).filter((x) => x != null);
    const r = noches.map((n) => n.rested).filter((x) => x != null);
    return {
        noches: noches.length,
        duracionMedia: duraciones.length ? media(duraciones) : null,
        acostarseMedio: acostarse.length ? aHora(media(acostarse)) : null,
        levantarseMedio: levantarse.length ? aHora(media(levantarse) - 12 * 60) : null,
        regularidadAcostarse: acostarse.length >= 3 ? desviacion(acostarse) : null,
        regularidadLevantarse: levantarse.length >= 3 ? desviacion(levantarse) : null,
        jetLagSocial: libres.length && laborables.length ? Math.abs(media(libres) - media(laborables)) : null,
        calidadMedia: q.length ? media(q) : null,
        descansoMedio: r.length ? media(r) : null,
    };
}
/** Ventana de alimentación por día (primera a última comida) y distancia entre la última comida y acostarse. */
export function resumenComidas(comidas, noches) {
    const porDia = new Map();
    for (const c of comidas) {
        const d = new Date(c.eaten_at);
        const k = d.toLocaleDateString('sv-SE');
        porDia.set(k, [...(porDia.get(k) ?? []), d]);
    }
    const dias = [...porDia.entries()].filter(([, ds]) => ds.length >= 2);
    const ventanas = dias.map(([, ds]) => (Math.max(...ds.map(Number)) - Math.min(...ds.map(Number))) / 60000);
    const primeras = dias.map(([, ds]) => { const d = new Date(Math.min(...ds.map(Number))); return d.getHours() * 60 + d.getMinutes(); });
    const ultimas = dias.map(([, ds]) => { const d = new Date(Math.max(...ds.map(Number))); return d.getHours() * 60 + d.getMinutes(); });
    const huecos = [];
    for (const [k, ds] of porDia) {
        const n = noches.find((x) => x.night_of === k && x.bedtime);
        if (n)
            huecos.push((new Date(n.bedtime).valueOf() - Math.max(...ds.map(Number))) / 60000);
    }
    const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
    return {
        dias: dias.length,
        ventanaMedia: ventanas.length ? media(ventanas) : null,
        primeraMedia: primeras.length ? hm(media(primeras)) : null,
        ultimaMedia: ultimas.length ? hm(media(ultimas)) : null,
        ultimaAntesDeDormir: huecos.filter((h) => h > 0).length ? media(huecos.filter((h) => h > 0)) : null,
    };
}
