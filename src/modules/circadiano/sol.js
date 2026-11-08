// Cálculo solar propio (algoritmo de la NOAA / Jean Meeus, el mismo que usan suncalc y la mayoría de apps).
// Sin GPS ni servicios externos: solo latitud y longitud de la ciudad del paciente.
// Precisión: alrededor de 1 minuto para amanecer y atardecer en latitudes de España.
const rad = Math.PI / 180;
const dia = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const e = rad * 23.4397; // oblicuidad de la eclíptica
const aJuliano = (d) => d.valueOf() / dia - 0.5 + J1970;
const deJuliano = (j) => new Date((j + 0.5 - J1970) * dia);
const aDias = (d) => aJuliano(d) - J2000;
const declinacion = (l) => Math.asin(Math.sin(e) * Math.sin(l));
const ascensionRecta = (l) => Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l));
const anomaliaMedia = (d) => rad * (357.5291 + 0.98560028 * d);
const longitudEcliptica = (M) => {
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    return M + C + rad * 102.9372 + Math.PI;
};
const tiempoSidereo = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
/** Altura del sol sobre el horizonte, en grados, en un momento y lugar. */
export function alturaSol(fecha, lat, lon) {
    const lw = rad * -lon;
    const phi = rad * lat;
    const d = aDias(fecha);
    const L = longitudEcliptica(anomaliaMedia(d));
    const dec = declinacion(L);
    const H = tiempoSidereo(d, lw) - ascensionRecta(L);
    return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / rad;
}
const J0 = 0.0009;
const cicloJuliano = (d, lw) => Math.round(d - J0 - lw / (2 * Math.PI));
const transitoAprox = (Ht, lw, n) => J0 + (Ht + lw) / (2 * Math.PI) + n;
const transitoSolar = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const anguloHorario = (h, phi, d) => Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));
/** Momentos del día en que el sol cruza una altura (subiendo y bajando). null si no llega a esa altura ese día. */
function cruces(fecha, lat, lon, altura) {
    const lw = rad * -lon;
    const phi = rad * lat;
    // Mediodía local aproximado para que el cálculo caiga en el día correcto
    const base = new Date(fecha);
    base.setHours(12, 0, 0, 0);
    const d = aDias(base);
    const n = cicloJuliano(d, lw);
    const ds = transitoAprox(0, lw, n);
    const M = anomaliaMedia(ds);
    const L = longitudEcliptica(M);
    const dec = declinacion(L);
    const Jnoon = transitoSolar(ds, M, L);
    const x = (Math.sin(altura * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (x < -1 || x > 1)
        return null;
    const w = anguloHorario(altura * rad, phi, dec);
    const a = transitoAprox(w, lw, n);
    const Jset = transitoSolar(a, M, L);
    const Jrise = Jnoon - (Jset - Jnoon);
    return { sube: deJuliano(Jrise), baja: deJuliano(Jset) };
}
function mediodia(fecha, lon) {
    const lw = rad * -lon;
    const base = new Date(fecha);
    base.setHours(12, 0, 0, 0);
    const n = cicloJuliano(aDias(base), lw);
    const ds = transitoAprox(0, lw, n);
    const M = anomaliaMedia(ds);
    return deJuliano(transitoSolar(ds, M, longitudEcliptica(M)));
}
// Umbrales de altura del sol (grados). Son aproximaciones prácticas, no medidas:
// - Amanecer/atardecer: -0,833° (borde del sol con refracción).
// - Primera/última luz (crepúsculo civil): -6°.
// - Ventana UVA: sol por encima de unos 10°. Por debajo, la luz es muy débil.
// - Ventana UVB / vitamina D: sol por encima de unos 30°. Por debajo, casi no llega UVB a la piel.
export const UMBRAL_UVA = 10;
export const UMBRAL_UVB = 30;
export function diaSolar(fecha, lat, lon) {
    const sol = cruces(fecha, lat, lon, -0.833);
    const civil = cruces(fecha, lat, lon, -6);
    const uva = cruces(fecha, lat, lon, UMBRAL_UVA);
    const uvb = cruces(fecha, lat, lon, UMBRAL_UVB);
    const md = mediodia(fecha, lon);
    return {
        fecha, mediodia: md,
        amanecer: sol?.sube ?? null, atardecer: sol?.baja ?? null,
        primeraLuz: civil?.sube ?? null, ultimaLuz: civil?.baja ?? null,
        uva: uva ? { desde: uva.sube, hasta: uva.baja } : null,
        uvb: uvb ? { desde: uvb.sube, hasta: uvb.baja } : null,
        alturaMaxima: alturaSol(md, lat, lon),
        horasDeLuz: sol ? (sol.baja.valueOf() - sol.sube.valueOf()) / 3600000 : null,
    };
}
/**
 * Cuántos días faltan para que cambie la ventana UVB:
 * - si hoy hay ventana, días hasta que desaparezca (hacia el invierno) o null si no desaparece en un año;
 * - si hoy no la hay, días hasta que vuelva.
 */
export function cambioVentanaUVB(fecha, lat, lon) {
    const hayHoy = !!cruces(fecha, lat, lon, UMBRAL_UVB);
    for (let i = 1; i <= 366; i++) {
        const f = new Date(fecha);
        f.setDate(f.getDate() + i);
        if (!!cruces(f, lat, lon, UMBRAL_UVB) !== hayHoy)
            return { hayHoy, dias: i };
    }
    return { hayHoy, dias: null };
}
export const horaMin = (d) => (d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—');
