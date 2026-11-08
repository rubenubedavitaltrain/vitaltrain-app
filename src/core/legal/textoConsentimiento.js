// Texto del consentimiento que acepta el paciente al entrar por primera vez.
// Cada cambio del texto sube la versión: el paciente tendrá que aceptarlo de nuevo.
// Copia legible para el asesor en docs/legal/consentimiento.md (se genera desde este archivo).
// BORRADOR pendiente de revisión por el asesor de protección de datos. Falta el plazo de conservación (entre corchetes).
export const VERSION_CONSENTIMIENTO = '1.1-borrador';
export const FECHA_CONSENTIMIENTO = '8 de noviembre de 2026';
/** Primera capa: lo esencial, en la pantalla de aceptación. */
export const RESUMEN = [
    'Clínica Vitaltrain usa esta app para acompañarte en el plan que te pauta tu profesional.',
    'Guardamos lo que registras: entrenamientos, series, cargas, esfuerzo, sensaciones, notas y, si las anotas, tus medidas. Algunos de estos datos son datos de salud.',
    'Solo los ve tu profesional. No se usan para publicidad, no se venden y no se toman decisiones automáticas sobre ti.',
    'La app no diagnostica ni decide tratamientos. Muestra lo que te pauta tu profesional y registra lo que haces.',
    'Los datos se guardan en servidores de la Unión Europea.',
    'Puedes retirar tu consentimiento cuando quieras desde Perfil, y ejercer tus derechos escribiendo a info@vitaltrain.com.',
];
/** Segunda capa: la información completa. */
export const SECCIONES = [
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
            'Mensajes que intercambies con tu profesional y documentos que te comparta.',
            'Datos técnicos de uso: fecha y hora de acceso y de cada registro, y el tipo de dispositivo con el que aceptas este texto.',
            'No recogemos tu ubicación, fotos, contactos ni datos de otras apps.',
            'La app no contiene tu historia clínica ni diagnósticos. Esa información sigue en el sistema de la clínica.',
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
        ],
    },
    {
        titulo: '5. Quién puede acceder',
        parrafos: [
            'Solo tu profesional y, si fuera necesario, personal de la clínica sujeto a confidencialidad. Otros pacientes nunca ven tus datos.',
            'Para que la app funcione usamos estos proveedores, que tratan los datos solo por cuenta de la clínica y con contrato de encargado del tratamiento:',
            '· Supabase: base de datos y acceso. Servidores en Frankfurt (Alemania, UE).',
            '· Cloudflare: alojamiento de la app. Sirve la aplicación, no guarda tus datos de salud.',
            '· Mailgun: envío de emails (código de acceso y avisos). Región UE.',
            'Algunas de estas empresas tienen sede en Estados Unidos. Cuando pueda haber acceso desde fuera de la UE, se aplican las garantías del Reglamento: Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo.',
            'Los vídeos de los ejercicios están en YouTube y se muestran en modo de privacidad mejorada. Al reproducir un vídeo, Google recibe datos técnicos de tu dispositivo, como la dirección IP. No recibe tus registros ni tus datos de salud.',
            'No cedemos tus datos a terceros, salvo obligación legal.',
        ],
    },
    {
        titulo: '6. Cuánto tiempo los conservamos',
        parrafos: [
            'Mientras sigas en el servicio y tengas la cuenta activa.',
            'Si te das de baja o retiras el consentimiento, tus datos se bloquean y se suprimen en un plazo de [plazo a fijar con el asesor], salvo que una ley obligue a conservarlos más tiempo.',
        ],
    },
    {
        titulo: '7. Tus derechos',
        parrafos: [
            'Puedes acceder a tus datos, rectificarlos, pedir que se supriman, oponerte o pedir que se limite su uso, y solicitar una copia para llevarla a otro servicio (portabilidad).',
            'Puedes retirar tu consentimiento en cualquier momento desde Perfil → Privacidad. Retirarlo no afecta a lo tratado antes.',
            'Para ejercer tus derechos, escribe a info@vitaltrain.com indicando qué necesitas.',
            'Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
        ],
    },
    {
        titulo: '8. Cómo los protegemos',
        parrafos: [
            'Las comunicaciones van cifradas. Entras con un código de un solo uso que llega a tu email, sin contraseñas que se puedan filtrar.',
            'Cada paciente solo puede ver lo suyo; está controlado en la propia base de datos, no solo en la app.',
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
    'Doy mi consentimiento explícito para que Clínica Vitaltrain trate mis datos de salud y de actividad física con el fin de hacer el seguimiento del plan que me pauta mi profesional.',
];
