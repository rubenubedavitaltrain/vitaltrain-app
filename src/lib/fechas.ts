// Fechas en hora local (Europe/Madrid en la práctica). Las fechas de la base de datos son "YYYY-MM-DD".

export const DIAS_CORTOS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function desdeIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sumarDias(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Lunes de la semana de esa fecha. */
export function lunes(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (c.getDay() + 6) % 7; // 0 = lunes
  return sumarDias(c, -dow);
}

export function hoyIso(): string {
  return iso(new Date());
}

export function diaMes(d: Date): string {
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function rangoSemana(l: Date): string {
  const f = sumarDias(l, 6);
  return l.getMonth() === f.getMonth() ? `${l.getDate()} – ${f.getDate()} ${MESES[f.getMonth()]}` : `${diaMes(l)} – ${diaMes(f)}`;
}
