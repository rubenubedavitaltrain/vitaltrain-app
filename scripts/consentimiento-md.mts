// Genera docs/legal/consentimiento.md a partir del texto que ve el paciente en la app.
// Uso: node scripts/consentimiento-md.mts
import fs from 'node:fs';
import { FECHA_CONSENTIMIENTO, FRASE_ACEPTACION, SECCIONES, VERSION_CONSENTIMIENTO } from '../src/core/legal/textoConsentimiento.ts';

const md = [
  '# Consentimiento para el uso de la app Vitaltrain',
  '',
  `Versión ${VERSION_CONSENTIMIENTO} · ${FECHA_CONSENTIMIENTO}`,
  '',
  'Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433',
  '',
  '> Borrador para revisión del asesor de protección de datos. Plazo de bloqueo propuesto: cinco años.',
  '> Este archivo se genera desde `src/core/legal/textoConsentimiento.ts`: los cambios se hacen allí.',
  '',
  '## Lo que ve el paciente al entrar',
  '',
  FRASE_ACEPTACION,
  '',
  'Debajo, el enlace «Leer las condiciones» (abre el texto completo) y los botones «Acepto» y «No acepto».',
  '',
  '## Condiciones completas',
  '',
  ...SECCIONES.flatMap((s) => [`### ${s.titulo}`, '', ...s.parrafos.flatMap((p) => [p.startsWith('· ') ? `- ${p.slice(2)}` : p, '']).filter((l, i, a) => !(l === '' && a[i + 1]?.startsWith('- ') && a[i - 1]?.startsWith('- ')))]),
  '## Qué se guarda al aceptar',
  '',
  'Se guarda: versión aceptada, fecha y hora, y tipo de dispositivo. El paciente puede retirarlo desde Perfil → Privacidad; desde ese momento la base de datos le impide ver y registrar datos.',
  '',
].join('\n');
fs.writeFileSync(new URL('../docs/legal/consentimiento.md', import.meta.url), md);
console.log('docs/legal/consentimiento.md generado');
