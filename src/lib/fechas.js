// Fechas en hora local (Europe/Madrid en la práctica). Las fechas de la base de datos son "YYYY-MM-DD".
export const DIAS_CORTOS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function desdeIso(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}
export function sumarDias(d, n) {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
}
/** Lunes de la semana de esa fecha. */
export function lunes(d) {
    const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (c.getDay() + 6) % 7; // 0 = lunes
    return sumarDias(c, -dow);
}
export function hoyIso() {
    return iso(new Date());
}
export function diaMes(d) {
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
export function rangoSemana(l) {
    const f = sumarDias(l, 6);
    return l.getMonth() === f.getMonth() ? `${l.getDate()} – ${f.getDate()} ${MESES[f.getMonth()]}` : `${diaMes(l)} – ${diaMes(f)}`;
}
