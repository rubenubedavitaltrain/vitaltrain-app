# Registro de decisiones

Cada decisión con fecha, qué se decidió y por qué. Se añade al final; no se borra lo anterior.

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-10-25 | App propia en vez de seguir en Harbiz | Integrar los cinco pilares y ritmos circadianos; coste ~85 % menor |
| 2026-10-25 | Cinco pilares como estructura de toda la plataforma | Alinear la app con el método Vitaltrain |
| 2026-10-25 | Primero entrenamiento, después el resto de módulos | Dejar Harbiz cuanto antes y no dispersarse |
| 2026-10-26 | Cloudflare Pages + React (Vite) en vez de Vercel + Next.js | Vercel Hobby prohíbe uso comercial; Pro cuesta 240 $/año; sin servidor propio no pasan datos de salud por el hosting; mejor encaje con Capacitor |
| 2026-10-26 | Login con código de 6 dígitos en vez de enlace mágico | En iOS el enlace abre Safari, que no comparte sesión con la PWA instalada |
| 2026-10-26 | Mailgun como SMTP de Supabase | El correo integrado solo envía al equipo y 2 mensajes por hora |
| 2026-10-26 | Dos entornos: vitaltrain-dev (Free) y vitaltrain-prod (Pro) | No desarrollar nunca sobre datos reales |
| 2026-10-26 | Prototipo navegable antes de programar | Corregir un dibujo cuesta menos que corregir código |
| 2026-10-26 | El repositorio es la única fuente de verdad | Evitar dos versiones de la especificación |
| 2026-10-26 | Emails de acceso desde el dominio vitaltrain.com de Mailgun, que ya está en la región UE, con remitente acceso@vitaltrain.com | Datos en la UE sin tocar el DNS. Subdominio aparte solo si la newsletter diera problemas de entrega |
| 2026-10-26 | YouTube se mantiene para los vídeos de la Fase 1; Bunny pasa a opcional | El canal no está monetizado: no salen anuncios. Con el ajuste rel=0, las sugerencias del final son solo de tu canal |
| 2026-10-26 | Baja de Harbiz al terminar la migración, sin fecha de renovación que vigilar | Harbiz se paga mensualmente |
| 2026-10-26 | Mensajes, progreso, nota por ejercicio, recordatorios, perfil con consentimiento, programas, documentos, medidas y resumen mensual pasan a la Fase 1 | La web promete comunicación directa y evolución; sin ellas la app sería un paso atrás frente a Harbiz. Retrasa la baja de Harbiz a finales de febrero de 2027 |
| 2026-10-26 | Medidas sin fotos | Las fotos corporales son datos muy sensibles y complican la parte legal |
| 2026-10-26 | Vídeo del ejercicio en vertical a pantalla completa al tocar la miniatura | Los vídeos de Rubén son YouTube Shorts verticales; incrustarlos en una caja horizontal los vería diminutos |
| 2026-10-26 | Frases de los cinco pilares (ver CLAUDE.md, sección 1) | Explican el porqué de cada pilar en una línea, con el enfoque de ir a la causa |
| 2026-10-26 | Programas de 1 a 12 semanas, con "Cambiar desde una semana" que borra solo las sesiones pendientes y asigna otro programa | Rubén necesita corregir programas largos a mitad de camino sin perder el historial del paciente |
| 2026-10-26 | Identidad de la app: nombre y símbolo de Vitaltrain con paleta (`#374949`, `#DCB733`, `#4A4A4C`, `#D2D6D4`) y tipografía Montserrat de la marca Rubén Úbeda | Los pacientes contratan a la clínica; la paleta de Rubén es la del contenido actual y expresa el enfoque integrativo; el coral antiguo no da contraste suficiente con texto blanco |
| 2026-10-26 | Tipografía de la app: Figtree en lugar de Montserrat | Preferencia de Rubén. Figtree es más compacta y legible en textos pequeños del móvil; la paleta de la opción A se mantiene |
| 2026-11-08 | La migración 0002 queda solo con el núcleo (pilares, módulos, ajustes). Hábitos, circadiano y cuestionarios pasan a `supabase/diseno/` sin aplicar | Así la base de datos real solo tiene lo que se usa. Cada módulo se aplicará con su migración y sus pruebas cuando se construya, sin tener que deshacer nada |
| 2026-11-08 | Acceso solo para personas dadas de alta por el coach (`shouldCreateUser: false`, altas libres desactivadas en Supabase) | Nadie puede crearse una cuenta por su cuenta escribiendo un email |
| 2026-11-08 | Librería `@supabase/supabase-js` 2.118.0 | Es el cliente oficial de Supabase para el acceso por código y la lectura de datos con las reglas de seguridad. Sin ella habría que reescribir lo mismo a mano |
| 2026-11-08 | GitHub suspende la cuenta `rubenubedavitaltrain`. Apelación enviada (ticket 4972927). No se abre otra cuenta mientras tanto | Abrir otra cuenta se considera eludir la suspensión. El código está a salvo en copias locales (bundle y zip) y la app publicada sigue funcionando |
| 2026-11-08 | Los vídeos de ejercicios siguen en YouTube como «Oculto». No se pasan a Bunny por ahora | Se pueden insertar en la app sin anuncios (canal no monetizado) ni coste. Bunny solo si hace falta vídeo sin conexión, quitar la marca de YouTube o impedir que se compartan enlaces |
| 2026-11-08 | Carga inicial de 156 Shorts leídos de YouTube Studio, con nombres limpiados (sin punto final ni mayúsculas sueltas; repetidos con «(2)») | Rubén los renombra y etiqueta desde la app. La miniatura se calcula a partir del id, no se guarda |
| 2026-11-08 | El guardián de perfiles permite cambios hechos desde el panel de Supabase (migración 0005) | Antes impedía al coach cambiar el estado de un paciente desde el editor SQL. La seguridad para usuarios con sesión no cambia y está probada |
| 2026-11-08 | Guardar plantillas con una función en la base de datos (`save_template`) que reemplaza bloques y ejercicios de una vez | Evita plantillas a medio guardar si se corta la conexión. Lo ya asignado no cambia porque cada asignación es una copia |
| 2026-11-08 | Alta de pacientes con una función de servidor (`alta-paciente`) | Crear cuentas necesita la clave de servicio, que no puede ir en la app. Solo la usa el coach |
| 2026-11-08 | Modo sin conexión con copia local del entrenamiento y cola de envío en el móvil | En el gimnasio puede no haber cobertura. Al cerrar sesión se borra todo lo guardado en el móvil |
| 2026-11-08 | La app del paciente muestra de momento Hoy, Semana y Perfil. Progreso y Mensajes se añadirán al menú cuando estén hechos | No enseñar pestañas vacías |
| 2026-11-08 | Revisión de seguridad independiente antes de aplicar 0006. Corregido: la cola sin conexión podía perder registros; lo guardado en el móvil queda ligado a cada cuenta; copiar semana no duplica; renombrar plantilla no borra su contenido; una nota nueva siempre llega como no leída; un paciente en pausa no puede cambiar su perfil; el email no se repite cambiando mayúsculas; la función de alta exige coach activo y deshace todo si falla | Detectado por una revisión hecha por un agente aparte. Cada corrección tiene su prueba (`npm run test:rls` y `npm run test:cola`) |
| 2026-11-08 | `alta-paciente` comprueba ella misma la sesión y el rol; la opción «Verify JWT with legacy secret» debe estar desactivada | El proyecto firma las sesiones con clave ECC nueva; con esa opción activa, la función rechaza al coach |
