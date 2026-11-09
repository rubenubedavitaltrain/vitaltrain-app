// Texto del consentimiento que acepta el paciente al entrar por primera vez.
// Cada cambio del texto sube la versión: el paciente tendrá que aceptarlo de nuevo.
// Copia legible para el asesor en docs/legal/consentimiento.md (se genera desde este archivo).
// BORRADOR pendiente de revisión por el asesor de protección de datos. Falta el plazo de conservación (entre corchetes).

export const VERSION_CONSENTIMIENTO = '1.3-borrador';
export const FECHA_CONSENTIMIENTO = '9 de noviembre de 2026';

/** Primera capa: lo esencial, en la pantalla de aceptación. */
export const RESUMEN: string[] = [
  'Clínica Vitaltrain usa esta app para acompañarte en el plan que te pauta tu profesional.',
  'Guardamos lo que registras: entrenamientos, sensaciones, notas, sueño, horarios de comida, hábitos, respuestas a cuestionarios, sesiones de respiración y, si las anotas, tus medidas. Algunos de estos datos son datos de salud.',
  'La clínica guarda también tu historia clínica en esta plataforma. Tú no la ves en la app, pero puedes pedir una copia.',
  'Solo los ve tu profesional. No se usan para publicidad, no se venden y no se toman decisiones automáticas sobre ti.',
  'La app no diagnostica ni decide tratamientos. Muestra lo que te pauta tu profesional y registra lo que haces.',
  'Los datos se guardan en servidores de la Unión Europea.',
  'Puedes retirar tu consentimiento cuando quieras desde Perfil, y ejercer tus derechos escribiendo a info@vitaltrain.com.',
];

export type Seccion = { titulo: string; parrafos: string[] };

/** Segunda capa: la información completa. */
export const SECCIONES: Seccion[] = [
  {
    titulo: '1. Quién es responsable de tus datos',
    parrafos: [
      'Responsable: Rubén Úbeda Rubio, con NIF 33452055G, titular de Clínica Vitaltrain, Centro Sanitario Nº Registro 22433.',
      'Dirección: Calle Sorní 40, 2, 46004 Valencia. Teléfono: 640 92 42 38. Email para temas de privacidad: info@vitaltrain.com.',
      'Profesional que te acompaña: Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209.',
    ],
  },
  {
    titulo: '2. Qué datos tratamos',
    parrafos: [
      'Datos de identificación y contacto: nombre, email y, si lo das, teléfono.',
      'Datos de actividad física y salud que registras tú o pauta tu profesional: plan de entrenamiento, series, repeticiones, cargas, esfuerzo percibido, sensaciones, notas por ejercicio, avisos de «No puedo hacerlo» con su motivo (por ejemplo, dolor o molestia) y, solo si decides anotarlas, medidas corporales (peso, cintura, cadera).',
      'Si tu profesional te activa esas secciones: horas de sueño y cómo has descansado, horas de las comidas (sin lo que comes), los hábitos que marcas cada día, tus respuestas a los cuestionarios (por ejemplo, cómo ha ido tu semana o tu cronotipo) y tus sesiones de respiración (duración y cómo te sentías antes y después). La ciudad que elijas sirve para calcular la luz del día; no usamos tu ubicación.',
      'Mensajes que intercambies con tu profesional y documentos que te comparta.',
      'Datos técnicos de uso: fecha y hora de acceso y de cada registro, y el tipo de dispositivo con el que aceptas este texto.',
      'No recogemos tu ubicación, fotos, contactos ni datos de otras apps.',
      'Historia clínica: la clínica registra en esta plataforma tu ficha clínica, las consultas de seguimiento y los documentos clínicos (por ejemplo, analíticas o informes). Solo la ve tu profesional, con una protección reforzada (doble código de acceso) y un registro de cada acceso. No aparece en tu app.',
    ],
  },
  {
    titulo: '3. Para qué los usamos',
    parrafos: [
      'Para prestarte el servicio de acompañamiento: mostrarte tu plan, registrar lo que haces y que tu profesional pueda revisar tu evolución y ajustar el plan.',
      'Para comunicaciones del servicio: el código de acceso por email, avisos de mensajes y los recordatorios que actives.',
      'Para mantener la seguridad y el buen funcionamiento de la app.',
      'No hacemos perfiles comerciales, no enviamos publicidad con estos datos y no tomamos decisiones automatizadas que te afecten.',
    ],
  },
  {
    titulo: '4. Base legal',
    parrafos: [
      'Tus datos de salud se tratan con tu consentimiento explícito (artículos 6.1.a y 9.2.a del Reglamento General de Protección de Datos).',
      'Tus datos de identificación y contacto se tratan para gestionar el servicio que has contratado (artículo 6.1.b).',
      'Dar tu consentimiento es voluntario. Sin él no puedes usar la app, pero tu acompañamiento puede seguir por otras vías que acuerdes con tu profesional.',
      'La historia clínica se trata para prestarte asistencia sanitaria (artículo 9.2.h del Reglamento) y conforme a la Ley 41/2002 de autonomía del paciente. No depende de este consentimiento: retirarlo no la borra.',
    ],
  },
  {
    titulo: '5. Quién puede acceder',
    parrafos: [
      'Solo tu profesional y, si fuera necesario, personal de la clínica sujeto a confidencialidad. Otros pacientes nunca ven tus datos.',
      'Para que la app funcione usamos estos proveedores, que tratan los datos solo por cuenta de la clínica y con contrato de encargado del tratamiento:',
      '· Supabase: base de datos y acceso. Servidores en Frankfurt (Alemania, UE).',
      '· Cloudflare: alojamiento de la app. Sirve la aplicación, no guarda tus datos de salud.',
      '· Mailgun (Sinch): envío de emails (código de acceso y avisos). Región UE.',
      'Algunas de estas empresas tienen sede en Estados Unidos. Cuando pueda haber acceso desde fuera de la UE, se aplican las garantías del Reglamento: Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo.',
      'Si activas los avisos en tu móvil, se entregan a través del servicio de notificaciones de Apple o de Google, según tu móvil. El aviso solo dice que tienes un mensaje o un entrenamiento pendiente; nunca lleva el texto del mensaje ni datos de salud.',
      'Los vídeos de los ejercicios están en YouTube y se muestran en modo de privacidad mejorada. Al reproducir un vídeo, Google recibe datos técnicos de tu dispositivo, como la dirección IP. No recibe tus registros ni tus datos de salud.',
      'No cedemos tus datos a terceros, salvo obligación legal.',
    ],
  },
  {
    titulo: '6. Cuánto tiempo los conservamos',
    parrafos: [
      'Mientras sigas en el servicio y tengas la cuenta activa.',
      'Si te das de baja o retiras el consentimiento, tus datos se bloquean y se suprimen en un plazo de [plazo a fijar con el asesor], salvo que una ley obligue a conservarlos más tiempo.',
      'La historia clínica se conserva como mínimo cinco años desde el alta de cada proceso asistencial, como exige la Ley 41/2002, y el tiempo adicional que fije la normativa aplicable.',
    ],
  },
  {
    titulo: '7. Tus derechos',
    parrafos: [
      'Puedes acceder a tus datos, rectificarlos, pedir que se supriman, oponerte o pedir que se limite su uso, y solicitar una copia para llevarla a otro servicio (portabilidad).',
      'Puedes retirar tu consentimiento en cualquier momento desde Perfil → Privacidad. Retirarlo no afecta a lo tratado antes.',
      'Puedes descargar lo que has registrado en la app desde Perfil → Privacidad → «Descargar mis datos». Para pedir tu historia clínica u otros derechos, escribe a info@vitaltrain.com indicando qué necesitas.',
      'Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
    ],
  },
  {
    titulo: '8. Cómo los protegemos',
    parrafos: [
      'Las comunicaciones van cifradas. Entras con un código de un solo uso que llega a tu email, sin contraseñas que se puedan filtrar.',
      'Cada paciente solo puede ver lo suyo; está controlado en la propia base de datos, no solo en la app.',
      'La historia clínica solo se abre con un segundo código de una app de autenticación, y cada acceso queda registrado.',
      'Se hacen copias de seguridad periódicas.',
      'Para que puedas entrenar sin conexión, la app guarda en tu móvil el plan de la semana. Se borra al cerrar sesión, salvo los registros que aún no se hayan podido enviar.',
    ],
  },
  {
    titulo: '9. Uso responsable',
    parrafos: [
      'La app no sustituye la atención sanitaria. Si sientes dolor intenso, mareo o cualquier síntoma que te preocupe, para y contacta con tu profesional. En una urgencia, llama al 112.',
      'La app es para personas mayores de edad.',
    ],
  },
  {
    titulo: '10. Cambios en este texto',
    parrafos: [
      'Si cambia algo importante, te lo mostraremos al entrar y te pediremos que lo aceptes de nuevo.',
    ],
  },
];

/** Casillas que el paciente debe marcar para aceptar. */
export const CASILLAS = [
  'He leído la información sobre cómo se tratan mis datos.',
  'Doy mi consentimiento explícito para que Clínica Vitaltrain trate los datos de salud y de actividad física que registro en la app con el fin de hacer el seguimiento del plan que me pauta mi profesional.',
];
