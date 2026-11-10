# Plataforma Vitaltrain — Especificación del proyecto

Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433

Este archivo es la fuente de verdad del proyecto. Claude Code debe leerlo al empezar cada sesión y actualizarlo cuando se tome una decisión nueva.

## 1. Visión

Una plataforma de acompañamiento en salud integrativa para los pacientes de Vitaltrain. Lleva a la vida diaria del paciente lo que se trabaja en consulta: entrenamiento, ritmos circadianos, hábitos por pilar, cuestionarios y aprendizaje.

No es una app genérica de bienestar. Refleja el método de Rubén: ir a la causa, no al síntoma, y ordenar la biología a través de pilares.

### Los cinco pilares (estructura de toda la plataforma)

| Pilar | Frase que ve el paciente |
|---|---|
| 1. Alimentación consciente | Qué comes importa. Cuándo y cómo lo comes, también. |
| 2. Movimiento inteligente | No se trata de entrenar más, sino de entrenar con sentido. |
| 3. Ritmos circadianos | Tu biología funciona por horarios. Respetarlos ordena todo lo demás. |
| 4. Regulación emocional | Tu sistema nervioso necesita calma para poder reparar. |
| 5. Contacto con la naturaleza | Sol, tierra y aire libre: los estímulos con los que evolucionó tu cuerpo. |

Las frases están en `pillars.description` (migración 0003). Se muestran bajo el nombre del pilar en "Hoy", en las tarjetas y en Documentos.

Todo hábito, cuestionario, contenido y módulo pertenece a un pilar. La navegación y el panel del coach se organizan por pilares. El entrenamiento es el primer módulo de Movimiento inteligente.

Principio rector: **el profesional prescribe, la app acompaña.** La app recuerda, registra y muestra tendencias. No diagnostica ni decide tratamientos por su cuenta.

Primer objetivo concreto: sustituir Harbiz (7 pacientes de entrenamiento online).

## 2. Arquitectura modular

La plataforma tiene un **núcleo** común y **módulos** que se activan por paciente.

### Núcleo (siempre presente)
- Usuarios y roles (coach, paciente), login con código de 6 dígitos por email.
- Pilares del método (tabla `pillars`, editable por el coach).
- Activación de módulos por paciente (`modules`, `patient_modules`).
- Pantalla "Hoy" del paciente: agrega lo que cada módulo activo aporta al día.
- Panel del coach con vista por paciente.
- Notificaciones push y mensajes.
- Conexión con WooCommerce (estado de pago).

### Contrato de un módulo
Cada módulo vive en su carpeta (`src/modules/<slug>/`) y aporta:
1. Sus tablas, en una migración propia.
2. Una tarjeta para la pantalla "Hoy" del paciente (si tiene algo para hoy).
3. Sus pantallas de paciente.
4. Su sección en la ficha del paciente del panel coach.
5. Sus indicadores para el resumen del coach.
6. Sus recordatorios push, si los tiene.

Un módulo nuevo no modifica los existentes. Si necesita algo del núcleo, se añade al núcleo de forma genérica.

### Motores genéricos reutilizables
- **Hábitos y protocolos** (`habit_definitions`, `patient_habits`, `habit_logs`): cualquier acción diaria de cualquier pilar. Tipos: sí/no, número, hora, duración, escala. Se pueden anclar a momentos del día (despertar, amanecer, atardecer, primera o última comida, hora de dormir) con un desfase en minutos.
- **Cuestionarios** (`questionnaires`, con preguntas en JSON): cronotipo, check-ins, cuestionarios de consulta. Se crean nuevos sin programar.

## 3. Módulos previstos

| Módulo | Qué hace | Fase |
|---|---|---|
| Entrenamiento (Movimiento inteligente) | Biblioteca, plantillas, programas de varias semanas, calendario, registro de series, nota por ejercicio | 1 |
| Mensajes | Conversación coach-paciente con aviso de mensaje nuevo | 1 |
| Seguimiento | Mi progreso (gráficas), medidas opcionales, resumen mensual para la revisión | 1 |
| Documentos | PDFs que el coach comparte con el paciente, por pilar | 1 |
| Perfil y avisos | Recordatorio de entrenamiento, avisos, consentimiento, descarga de datos | 1 |
| Ritmos circadianos | Panel solar de la ciudad (amanecer, atardecer, UVA, UVB), registro de sueño y de comidas, indicadores para el coach. Hecho (0.13.0); «Mi día» con anclas y hábitos en su hora (0.15.0); recordatorios en los hábitos de Mi día (0.22.0) | 2 |
| Hábitos | Protocolos diarios por pilar asignados por el coach. Hecho (0.13.0): catálogo de 23 hábitos de los 5 pilares, asignar, marcar en Hoy, constancia | 2 |
| Cuestionarios | Cronotipo, check-in semanal PNI y cuestionarios cortos de seguimiento. Hecho (0.17.0): rMEQ y check-in semanal; editor del coach (0.23.0). Los cuestionarios de inicio de paciente siguen en Fluent Forms / FluentCRM (10 nov 2026) | 3 |
| Aprendizaje | Contenidos por pilar (vídeo, texto), enlazables con la Escuela | 4 |
| Respiración y regulación | Ejercicios guiados con temporizador. Hecho (0.18.0): respiración lenta, suspiro fisiológico y 4-7-8, con calma antes y después. Falta: audios guiados | 4 |
| Asistente IA | Borradores de rutinas y protocolos para revisión del coach | 5 |
| Wearables | Datos de sueño y actividad (Apple Health requiere app nativa vía Capacitor) | 5 |

### Planes de acceso (decidido el 9 nov 2026)

El cobro lo hace WooCommerce Subscriptions con Stripe en vitaltrain.com (ya instalado y en uso). La app no cobra: un webhook de WooCommerce abre o cierra módulos según el estado de la suscripción del mismo email.

| Plan | Precio | Qué abre en la app |
|---|---|---|
| Ritmo (gratis) | 0 € | Lo básico del sol: panel solar de su ciudad y ventana de vitamina D. Estilo MyCircadian |
| Comunidad | 15 €/mes hasta el 1 ene 2027, luego 25 €/mes (anual 150 €, luego 250 €). Producto WooCommerce 13847 | Comunidad de la web + ritmos circadianos completos (registros de sueño y comidas, datos e indicadores, cuestionarios) y hábitos |
| Entrenamiento personal | Como ahora (producto «Entrenamiento online», 39-59 €/mes) | Entrenamiento pautado por Rubén + ritmos circadianos completos. Sin comunidad |
| Completo | 79 €/mes (producto nuevo, por crear) | Entrenamiento personal + comunidad + todo lo de la app |

Pacientes de consulta: al aceptar las condiciones del cuestionario de admisión ya están en el CRM interno (historia clínica). En la app tienen el plan gratuito más una comunicación básica con Rubén (mensajes). Nada más por ser paciente: comunidad y entrenamiento se pagan aparte.

Pendiente de construir: alta libre del plan gratuito (con consentimiento y EIPD antes) y producto Completo de 79 €. Webhook de WooCommerce hecho en 0.20.0 (propone, el coach aplica).

Nutrición queda fuera por ahora. Los planes de alimentación se comparten como PDF en Documentos.

### Alcance de la Fase 1 (decidido el 26 oct 2026)

Todo esto debe funcionar antes de dejar Harbiz. El prototipo aprobado de cada pantalla está en el lienzo de diseño "Prototipo App Vitaltrain" (16 pantallas).

Paciente (móvil, menú de 5 pestañas: Hoy, Semana, Progreso, Mensajes, Perfil):
1. Acceso con código de 6 dígitos.
2. Hoy: entrenamiento del día, mensaje del coach, semana resumida, pilares (los no activos en gris).
3. Entrenamiento en curso: vídeo, series con carga y repeticiones precargadas, temporizador de descanso, modo sin conexión.
4. Nota por ejercicio y botón "No puedo hacerlo" con motivo (dolor o molestia, sin material, no sé hacerlo, otro).
5. Final: esfuerzo 1-10, sensaciones, notas.
6. Mi semana.
7. Mi progreso: entrenamientos por semana, carga por ejercicio, esfuerzo medio.
8. Mensajes con el coach. Aviso de mensaje nuevo (push; email si no hay push).
9. Perfil: recordatorio de entrenamiento con hora, avisos de mensajes, privacidad (consentimiento, qué datos se guardan, descargar mis datos, retirar consentimiento), cerrar sesión.
10. Mis documentos (PDF por pilar).
11. Mis medidas: peso, cintura, cadera. Opcional, sin fotos.

Coach (ordenador):
12. Panel: adherencia semanal, pacientes sin entrenar, notas y mensajes sin leer.
13. Ficha del paciente: calendario semanal, copiar semana anterior, notas del paciente, progresión, notas privadas.
14. Constructor de entrenamientos por bloques. Rubén diseña desde cero para cada paciente (8 nov 2026): el constructor se usa directamente en la ficha del paciente; las plantillas son opcionales.
15. Programas de 1 a 12 semanas, con una regla de progresión por semana; al asignar se crean las sesiones en el calendario del paciente. En un programa en curso, "Cambiar desde una semana": se elige la semana (la actual o cualquier futura), se borran solo las sesiones pendientes desde ese lunes y se asigna en su lugar otro programa o semanas nuevas. Las sesiones hechas, en curso o con registros nunca se borran.
16. Mensajes: bandeja por paciente con contexto y respuestas rápidas.
17. Resumen mensual por paciente: adherencia, esfuerzo, cargas, medidas, notas; conclusiones del coach; PDF y compartir con el paciente.

## 4. Módulo de ritmos circadianos (detalle)

### Paciente
- **Perfil circadiano**: cronotipo (cuestionario rMEQ, 5 preguntas, Adan y Almirall 1991), días laborables y ciudad. Con la ciudad se calculan amanecer y atardecer reales de cada día (cálculo propio en el cliente). Opción «Usar mi ubicación actual» (0.21.0): la posición del móvil se usa solo en el propio móvil, redondeada a ~1 km, y nunca se envía al servidor.
- **Mi día**: una línea temporal con las anclas que el coach ha configurado para ese paciente. Ejemplo: luz natural en los 30 min tras despertar, primera comida, última comida 3 h antes de dormir, luz tenue desde 1 h antes del atardecer, hora de acostarse.
- **Registro de sueño** en menos de 20 segundos: hora de acostarse y levantarse, latencia, despertares, calidad, cómo se levanta.
- **Registro de comidas**: solo la hora y el tipo, para ver la ventana de alimentación. Sin calorías.
- **Recordatorios** opcionales en cada ancla.

### Coach
- Regularidad del sueño: variabilidad de las horas de acostarse y levantarse.
- Jet lag social: diferencia del punto medio del sueño entre días libres y laborables (Wittmann et al., 2006).
- Ventana de alimentación media y hora de la última comida respecto a la hora de dormir.
- Adherencia a la luz matinal y a las anclas.
- Todo cruzado con el check-in semanal (sueño, energía, digestión, estrés, dolor) y con la carga de entrenamiento.

## 5. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Formato | PWA instalable, con modo sin conexión para el entrenamiento del día. Capacitor más adelante para tiendas y Apple Health, sin reescribir |
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui. Web estática (SPA), sin servidor propio |
| Hosting | Cloudflare Pages (gratis, uso comercial permitido). Enlace de prueba por cada cambio |
| Backend | Supabase: Postgres, Auth, Realtime, Storage y Edge Functions (webhook WooCommerce, push, IA). Región UE (Frankfurt) |
| Entornos | `vitaltrain-dev` (Supabase Free, datos inventados, ref `jlcrmozctsvgnousstbu`) y `vitaltrain-prod` (Supabase Pro, organización propia, ref `idzbwtlnhlkxcnhfvxcp`). Nunca desarrollar contra producción. vitaltrain-app.pages.dev usa prod; los enlaces de prueba de cada cambio usan dev |
| Login | Código de 6 dígitos por email (OTP). No enlace mágico: en iOS abre Safari y no la PWA instalada. Solo el coach da de alta pacientes |
| Email | Mailgun como SMTP propio de Supabase. Dominio vitaltrain.com, ya en la región UE (smtp.eu.mailgun.org). Remitente propio para la app: acceso@vitaltrain.com |
| Calidad | Pruebas de seguridad de datos (RLS) y de pantallas en GitHub Actions. Un cambio no se publica si fallan |
| Vídeos | YouTube (canal no monetizado: sin anuncios), embed `youtube-nocookie.com` con rel=0. Bunny Stream opcional más adelante. Campo `video_provider` |
| Formato de vídeo | Los ejercicios son YouTube Shorts verticales (9:16), de 15-60 s. En el entrenamiento se muestra una miniatura y al tocarla se abre a pantalla completa en vertical. La importación acepta enlaces `youtube.com/shorts/<id>` y `youtu.be/<id>` |
| Cobro | WooCommerce en vitaltrain.com. La app no cobra. Webhook activa o pausa el acceso |
| Idioma | Solo español |
| Coaches | Uno (Rubén). El rol `coach` existe por si hay más en el futuro |

## 6. Identidad visual y tono

Decidido el 26 oct 2026 (opción A): **nombre y símbolo de Vitaltrain, paleta y tipografía de la marca Rubén Úbeda** (manual de Creactivity Lab, 2025).

- Verde petróleo `#374949` (cabeceras, navegación, fondo del icono)
- Mostaza `#DCB733` (acento, botones principales, símbolo en el icono)
- Gris oscuro `#4A4A4C` (texto)
- Gris claro `#D2D6D4` (separadores, fondos secundarios)
- Fondo general `#ECECEC`; texto secundario `#5A6464` (contraste 4.5:1 sobre blanco)
- Tipografía: Figtree (400, 500, 600, 700), servida desde la propia app con `@fontsource/figtree`. Rubén la prefiere a la Montserrat del manual (26 oct 2026)
- Logos en `public/marca/`: símbolo de Vitaltrain en mostaza y logotipo en blanco y en petróleo, sacados de los originales de Rubén
- No usar el azul marino ni el coral del manual antiguo de Vitaltrain. No usar la R de Rubén Úbeda en la app

Textos de la app: claros, directos, frases cortas, sin emojis ni lenguaje de marketing. Cada hábito explica su porqué en una o dos frases.
Diseño primero para móvil: botones grandes, poco texto, registro rápido.

## 7. Modelo de datos

- `supabase/migrations/0001_schema.sql`: núcleo de usuarios y módulo de entrenamiento.
  - `profiles` (un trigger impide que el paciente cambie su rol, estado o email), `coach_notes` (privadas).
  - `exercises`; `templates` → `template_blocks` → `template_items`.
  - `workouts` → `workout_blocks` → `workout_items` (copia al asignar), `set_logs`.
  - `checkins`, `messages`, `memberships`, `push_subscriptions`.
- `supabase/migrations/0002_plataforma_modular.sql`: núcleo modular: `pillars`, `modules`, `patient_modules`, `patient_settings`.
- `supabase/diseno/fase2_habitos_circadiano_cuestionarios.sql`: lo que queda del diseño de fase 2 (hábitos, circadiano y cuestionarios ya pasaron a 0014, 0015 y 0020). La prueba de seguridad comprueba que sigue siendo válido.

- `supabase/migrations/0003_frases_pilares.sql`: frase de cada pilar.
- `supabase/migrations/0004_biblioteca_ejercicios.sql`: duración del vídeo en `exercises`, un vídeo no puede repetirse, y carga de los 156 Shorts del canal (lista en `supabase/datos/ejercicios_youtube.json`). Los vídeos están como "Oculto" en YouTube: nunca ponerlos en "Privado" o dejarán de verse en la app.
- `supabase/migrations/0005_ajuste_perfiles_admin.sql`: el guardián de perfiles ya no bloquea los cambios hechos desde el panel de Supabase (sin usuario conectado).
- `supabase/migrations/0006_plantillas_y_registro.sql`: carga pautada (`load_kg`) en plantillas y entrenamientos, `save_template(jsonb)` (guarda la plantilla entera de una vez), `copy_week`, guardián de columnas de `workouts` para el paciente (solo estado, inicio, fin, esfuerzo, sensaciones y notas) y `workout_item_feedback` (nota y "no puedo hacerlo" con motivo: pain, no_equipment, dont_know, other).
- `supabase/functions/alta-paciente`: función de servidor que crea la cuenta, el perfil y activa el módulo de entrenamiento. Solo la puede usar el coach (lo comprueba ella misma). Se despliega desde el editor de Edge Functions de Supabase con «Verify JWT with legacy secret» desactivado: el proyecto firma las sesiones con clave ECC. Desplegada en `vitaltrain-dev` el 8 nov 2026.
- `supabase/migrations/0007_programas.sql`: programas de 1 a 12 semanas. `programs`, `program_weeks` (carga en % de -50 a 50 y nota para el paciente), `program_slots` (semana, día, plantilla) y `program_assignments` (empieza siempre en lunes; estados active, replaced, cancelled). `workouts` gana `program_assignment_id` y `program_week`. Funciones: `save_program(jsonb)`, `assign_program`, `replace_program_from_week` (solo semana actual o futuras; borra solo sesiones `scheduled` sin series ni notas). Aplicada en `vitaltrain-dev` el 8 nov 2026.
- `supabase/migrations/0008_sesion_a_medida.sql`: `save_workout(jsonb)` crea una sesión a medida para un paciente en una o varias fechas (máx. 84), o edita una suya si está pendiente y sin series ni notas. `_fill_workout` es interna. Aplicada en `vitaltrain-dev` el 8 nov 2026.
- `supabase/migrations/0009_consentimiento.sql`: `consents` (versión, aceptado, retirado, sustituido, dispositivo). `is_active_patient()` exige ahora un consentimiento en vigor: sin él, el paciente no ve ni registra nada. Solo se escribe con `accept_consent(versión)` y `withdraw_consent()`; el coach lo ve pero no puede aceptar por el paciente. El texto vive en `src/core/legal/textoConsentimiento.ts` (cambiarlo exige subir la versión) y su copia para el asesor en `docs/legal/consentimiento.md` (`node scripts/consentimiento-md.mts`). Pantalla de aceptación: una frase (`FRASE_ACEPTACION`), enlace «Leer las condiciones» y botón «Acepto» (9 nov 2026).
- `supabase/migrations/0010_cambiar_ejercicio.sql`: `replace_exercise(paciente, de, a, desde, carga, quitar_carga, indicación)` cambia un ejercicio por otro en todas las sesiones pendientes del paciente desde una fecha. No toca sesiones hechas ni ejercicios con series o notas. Mantiene series, repeticiones y descanso. Aplicada en `vitaltrain-dev` el 8 nov 2026.
- `supabase/migrations/0011_medidas.sql`: `body_measurements` (peso 20-350 kg, cintura y cadera 30-250 cm, una fila por paciente y día, al menos un valor, nunca fecha futura). Es del núcleo: la anota cualquier paciente activo con consentimiento, y el coach. Aplicada en `vitaltrain-dev` el 8 nov 2026.
- `supabase/migrations/0012_mensajes.sql`: deja lista la tabla `messages` (de 0001): un disparador fija el remitente (quien está conectado), la fecha y «sin leer» al crear; el paciente solo escribe en su conversación; el coach solo en conversaciones de pacientes; nadie edita mensajes y solo el coach puede borrar; `mark_messages_read(paciente)` marca como leídos solo los recibidos. Módulo `messages` disponible. Aplicada en `vitaltrain-dev` el 8 nov 2026.
- `supabase/migrations/0013_correcciones_revision.sql`: correcciones de la revisión independiente: un disparador impide borrar ejercicios con series o notas del paciente venga de donde venga; una nota cambiada por el paciente vuelve a «sin leer»; `hoy_local()` da la fecha de España (las medidas y «Cambiar desde una semana» la usan). Aplicada en `vitaltrain-dev` el 8 nov 2026.
- `supabase/migrations/0014_circadiano.sql`: `sleep_logs` (una noche por paciente y fecha, despertar posterior a acostarse y menos de 20 h, sin noches ni horas futuras) y `meal_events` (hora y tipo; últimos 30 días). El paciente escribe solo con el módulo `circadian` activo. La ciudad va en `patient_settings` (latitud y longitud de la ciudad, no GPS). Aplicada en `vitaltrain-dev` el 8 nov 2026.
- `supabase/migrations/0015_habitos.sql`: motor de hábitos (`habit_definitions`, `patient_habits`, `habit_logs`) y catálogo inicial de 23 hábitos por pilar. El paciente ve y marca sus hábitos solo con el módulo `habits`; marca hoy o la última semana, solo en hábitos suyos y activos; no puede asignarse ni cambiar objetivos. Aplicada en `vitaltrain-dev` el 8 nov 2026.
- Código: `src/modules/circadiano/` (`sol.ts` cálculo solar NOAA/Meeus, `ciudades.ts`, `PanelSolar`, `Registros`, `Graficas`, `Ritmo` con la tarjeta de Hoy, Mi ritmo y la sección del coach) y `src/modules/habitos/` (`datos.ts`, `Habitos.tsx` con la tarjeta de Hoy y Constancia, `HabitosCoach.tsx`). Activación por paciente en `src/core/coach/ModulosPaciente.tsx`.
- `supabase/migrations/0016_documentos.sql`: `patient_documents` y bucket privado `documentos` (solo PDF, 20 MB). El coach sube y borra; el paciente abre solo los suyos compartidos. Aplicada en `vitaltrain-dev` el 9 nov 2026.
- `supabase/migrations/0017_resumen_mensual.sql`: `monthly_reviews` (mes, conclusiones, objetivos, foto fija `snapshot`, `shared_at`). Aplicada el 9 nov 2026.
- `supabase/migrations/0018_historia_clinica.sql`: historia clínica. `clinical_records` (+ `clinical_record_versions`), `consultations` (borrador/cerrada) y `consultation_addenda`, `clinical_documents` + bucket privado `historia` (PDF, imagen, Word; 50 MB), `access_log`, `is_coach_mfa()`, `registrar_acceso()`. Aplicada el 9 nov 2026.
- Código: `src/core/documentos/`, `src/core/resumen/` y `src/core/historia/` (`DobleFactor.tsx`, `Historia.tsx` con línea de tiempo, consultas, ficha, documentos clínicos y registro de accesos).
- `supabase/migrations/0019_avisos.sql`: `patient_settings` gana `reminder_enabled`, `reminder_time`, `notify_messages`; `app_settings` (solo la clave pública VAPID), `notification_log` (avisos enviados, sin repetir), `guardar_suscripcion()` y `guardar_secreto_avisos()` (Vault). Aplicada el 9 nov 2026. `supabase/manual/reloj_avisos.sql`: pg_cron cada 15 min → función `avisos` (aplicado en dev).
- `supabase/functions/avisos`: web push (npm:web-push) y email de respaldo por la API de Mailgun (región UE). Secretos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET, MAILGUN_API_KEY (y APP_URL en producción). Desplegada en dev el 9 nov 2026; «Verify JWT» debe ir desactivado.
- Código: `src/core/avisos/` y `public/push-sw.js` (cargado por el service worker).
- `supabase/migrations/0020_cuestionarios.sql`: `questionnaires` (preguntas en JSON: single, scale, text; `scored`), `questionnaire_assignments` (una vez o `weekly`), `questionnaire_responses` (una por asignación y periodo: `unico` o semana ISO). Un disparador valida las respuestas, fija el periodo, calcula la puntuación y, en el rMEQ, guarda `chronotype` y `chronotype_score` en `patient_settings`. El paciente solo inserta, con el módulo `questionnaires`. Cuestionarios iniciales: `rmeq` y `checkin-semanal`. Aplicada el 9 nov 2026.
- Código: `src/modules/cuestionarios/` (`datos.ts`, `Cuestionarios.tsx` con la tarjeta de Hoy y el formulario, `CuestionariosCoach.tsx`). El resumen mensual incluye las medias del check-in.
- `supabase/migrations/0021_respiracion.sql`: `breathing_sessions` (pauta lenta, suspiro o 478; segundos 30-3600; calma antes y después 1-5). El paciente solo inserta (últimos 2 días, nunca futuro) con el módulo `breathing`; no edita ni borra. Aplicada el 9 nov 2026.
- Código: `src/modules/respiracion/` (`pautas.ts`, `Respiracion.tsx` con la tarjeta de Hoy y la sesión a pantalla completa, `RespiracionCoach.tsx`).
- `supabase/migrations/0022_borrado_bloqueados.sql`: `profiles.archived_at` (lo fija un disparador al archivar), `purge_log` (registro de borrados, solo lectura del coach) y `purgar_datos_bloqueados()`, que borra los datos de la app de pacientes dados de baja o con el consentimiento retirado hace más de 5 años. No toca la historia clínica ni `patient_documents`; sin historia ni documentos borra la cuenta.
- `supabase/migrations/0023_borrado_autorizado.sql`: quita el reloj y el borrado en bloque de 0022. `pendientes_de_borrar()` (lista, solo coach con doble factor) y `borrar_datos_bloqueados(paciente)` (uno a uno, autorizado por el coach con doble factor; queda en `purge_log.autorizado_por`). Doble factor configurable también desde Ajustes del coach (0.19.1). Pantalla: `src/core/legal/BorradosPendientes.tsx` en el Inicio del coach (norma, qué comprobar, casilla de validación). La función `avisos` envía al coach un email al mes pidiendo autorización si hay pendientes (`_pendientes_de_borrar()`, solo service_role); nunca borra.
- Código: `src/core/historia/CopiaPaciente.tsx`: copia legible de la historia clínica para el paciente (PDF por impresión).
- `supabase/migrations/0025_modulo_sol.sql`: módulo `sun` («Sol y vitamina D»). Código en `src/modules/sol/Sol.tsx` (TarjetaSol, MiSol, SolCoach). Lo común pasa al núcleo: `src/core/sol/` (`sol.ts`, `ciudades.ts`, `PanelSolar.tsx`, `Ciudad.tsx` con el selector, `cargarCiudad`, `guardarCiudad` y la ubicación actual solo en el móvil) y `src/core/ui/Hoja.tsx`.
- `supabase/migrations/0026_ajustes_seguridad.sql`: el paciente registra entrenamiento (series, notas por ejercicio, terminar sesión) solo con el módulo `training`; fechas de inicio y fin de sesión no futuras (margen 1 h); límites NOT VALID de longitud: `workouts.feeling` 500, `patient_notes` 2000, `coach_notes.body` 1-4000. No toca datos existentes.
- `supabase/migrations/0027_recordatorios_habitos.sql`: `patient_habits.remind_at` y `poner_recordatorio_habito(id, activar, hora)` (solo el paciente, en hábitos suyos, activos y con ancla, con el módulo `habits`). La hora la calcula el móvil (`MiDia.tsx`); la función `avisos` envía push a esa hora si hoy toca y no está marcado (kind `recordatorio_habito`).
- `supabase/migrations/0028_editor_cuestionarios.sql`: `questionnaires` gana `is_system` (rmeq y checkin-semanal, no editables) y `default_recurrence`. Disparador que valida el esquema (1-40 preguntas, ids únicos, opciones 2-12 con valores distintos, escala entera de 1 a 10 pasos, texto sin puntos), sube `version` al cambiar preguntas y lo impide si ya hay respuestas; no se borra un cuestionario en uso. Pantalla: `src/modules/cuestionarios/EditorCuestionarios.tsx` (pestaña «Cuestionarios» del coach).
- `supabase/migrations/0024_suscripciones.sql`: `plan_products` (producto WooCommerce → módulos; Comunidad 13847 de partida), `memberships` gana variación y fecha de aviso, `registrar_suscripcion(jsonb)` (solo service_role; enlaza por email, no toca módulos), disparador que enlaza al dar de alta, `cambios_suscripcion()` (propuestas para el coach) y `aplicar_cambio_suscripcion(paciente)` (el coach aplica; solo abre o cierra módulos). Función `supabase/functions/woocommerce` (firma HMAC con `WOO_WEBHOOK_SECRET`, Verify JWT desactivado). Pantallas en `src/core/suscripciones/Suscripciones.tsx`. Guía: `docs/WOOCOMMERCE.md`.

Seguridad: Row Level Security en todas las tablas. El paciente solo ve lo suyo y solo escribe en módulos que tiene activos. El coach lo ve todo.

Pruebas de seguridad: `supabase/tests/rls.test.mjs` aplica todas las migraciones en un Postgres embebido y comprueba los permisos. Se ejecuta en GitHub Actions en cada cambio (`.github/workflows/seguridad-datos.yml`). Cada tabla o regla nueva añade sus pruebas ahí.

## 8. Marco legal y de datos

- Datos de salud: categoría especial (art. 9 RGPD). Todo alojado en la UE.
- **Historia clínica en la plataforma** (decidido el 9 nov 2026, con el visto bueno del asesor; antes no se guardaba). Requisitos que no se pueden relajar:
  - Solo el coach con doble factor (sesión `aal2`); lo comprueba la base de datos (`is_coach_mfa()`).
  - Conservación: nada clínico se borra. Datos de la app: bloqueados 5 años tras la baja o la retirada del consentimiento y después borrados (aprobado por la asesora, 9 nov 2026). Ficha con versiones, consultas cerradas con adendas, documentos borrables solo 24 h, perfiles con historia no eliminables.
  - Registro de accesos (`access_log`) escrito por la base de datos, sin edición ni borrado.
  - Pacientes reales solo en `vitaltrain-prod` (Pro, copias de seguridad, DPA firmado). Nunca en `vitaltrain-dev`.
  - El paciente no ve su historia en la app; el derecho de acceso se atiende con «Copia para el paciente» (PDF) y los archivos aparte (0.19.0).
- DPA firmado con Supabase y el hosting antes de meter pacientes reales. Revisión por el asesor de protección de datos.
- Producto sanitario: el software que genera de forma autónoma recomendaciones diagnósticas o terapéuticas puede considerarse producto sanitario (Reglamento UE 2017/745). Por eso la app no decide: muestra lo que el profesional pauta y registra lo que hace el paciente. Cualquier función de IA genera borradores para el coach, nunca recomendaciones directas al paciente. Validarlo con asesoría antes de la fase 5.
- Nunca usar datos reales en desarrollo. Claves solo en variables de entorno.

## 9. Reglas de trabajo para Claude Code

- **Datos: nada sin autorización de Rubén (9 nov 2026):** ni la app ni Claude borran o cambian datos de pacientes por su cuenta. Nada automático que borre. Cualquier borrado o cambio de datos en producción lo valida Rubén antes.
- **Construir: autonomía (10 nov 2026):** para construir la app, mejorarla y hacerla crecer, Claude avanza solo (código, pruebas, entorno de pruebas, PR) sin pedir permiso en cada paso. Las acciones que la herramienta bloquea en producción (pulsar Run o Deploy en `vitaltrain-prod`, fusionar en main) las deja preparadas y Rubén solo pulsa.

- Comandos: comprobar tipos con `npx tsc --noEmit` (nunca `tsc -b`: escribe .js junto a los .tsx y Vite los cogería antes). `npm ci` para instalar, `npm run dev` para probar en local, `npm run build` para compilar (sale a `dist/`), `npm run test:rls` para las pruebas de seguridad, `npm run test:cola` para la cola sin conexión.
- Versiones de dependencias fijadas, con al menos dos semanas desde su publicación.

- Tareas pequeñas y comprobables. Cada una termina con algo que Rubén pueda probar en el móvil.
- Explicar los cambios en lenguaje llano: Rubén no es programador.
- Justificar cada dependencia nueva antes de instalarla.
- Cambios de base de datos siempre como migración nueva numerada.
- Respetar el contrato de módulo (sección 2). No mezclar código de un módulo en otro.
- No empezar un módulo nuevo hasta que el anterior esté en uso real por pacientes. Excepción decidida por Rubén el 8 nov 2026: ritmos circadianos y hábitos se adelantan mientras GitHub está suspendido.
- Mantener actualizada la sección 10, `docs/DECISIONES.md` (fecha, decisión, motivo) y `docs/NOVEDADES.md` (qué cambió y cómo probarlo, en lenguaje llano).
- Cada propuesta de cambio explica en español llano qué hace, cómo probarlo en el móvil y qué podría fallar.
- Las migraciones se aplican en `vitaltrain-dev` desde el editor SQL de Supabase, en orden, y se anotan en `docs/NOVEDADES.md`. Nunca editar una migración ya aplicada: se crea otra nueva.
- Acceso: `signInWithOtp` con `shouldCreateUser: false` y `verifyOtp` tipo `email`. En Supabase: altas libres desactivadas, código de 6 dígitos, plantilla de email con `{{ .Token }}`.
- Variables de entorno de la app (Cloudflare Pages, producción y vista previa): `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (clave pública). La `service_role` nunca va en la app ni en Cloudflare.

## 10. Estado actual

- [x] Especificación y modelo de datos del núcleo, entrenamiento, circadiano, hábitos y cuestionarios (oct 2026)
- [x] Pilares y su frase confirmados (26 oct 2026)
- [x] Auditoría de la propuesta (26 oct 2026): Cloudflare + React en vez de Vercel + Next.js, login por código, dos entornos, prototipo antes de código
- [x] Cuentas: GitHub, Supabase `vitaltrain-dev` (Frankfurt), Cloudflare, Mailgun en región UE (26 oct 2026)
- [x] Repositorio `rubenubedavitaltrain/vitaltrain-app` creado y app de Claude instalada (26 oct 2026)
- [ ] Subdominio app.vitaltrain.com (etapa 5)
- [x] Prototipo v1 (8 pantallas) revisado por Rubén (26 oct 2026)
- [x] Alcance de la Fase 1 ampliado a 17 funciones (26 oct 2026)
- [x] Prototipo v2 (16 pantallas) aprobado (26 oct 2026)
- [x] Tarea 1: proyecto React + PWA creado, con iconos, cabeceras de seguridad y compilación comprobada en cada cambio (26 oct 2026)
- [x] Identidad visual de la app decidida: opción A (26 oct 2026)
- [x] Cloudflare Pages conectado: https://vitaltrain-app.pages.dev se publica solo con cada cambio en main (26 oct 2026)
- [x] Tarea 2: tablas en `vitaltrain-dev` (0001, 0002 núcleo, 0003), acceso con código de 6 dígitos por Mailgun (acceso@vitaltrain.com), cuenta de coach `ruben.ubeda@vitaltrain.com`. Probado en el móvil (8 nov 2026)
- Supabase `vitaltrain-dev`: proyecto `jlcrmozctsvgnousstbu`. Altas libres desactivadas, código de 6 dígitos que caduca en 15 min, plantilla de email en español con el código en el asunto
- [x] GitHub suspendió la cuenta `rubenubedavitaltrain` (8 nov 2026, ticket 4972927) y la restableció el 9 nov 2026. Todas las ramas subidas ese día. Supabase tiene un segundo Owner con email y contraseña (`ruben.ubeda@vitaltrain.com`) para no depender de GitHub
- [ ] Tarea 3: biblioteca de ejercicios. Hecho: migraciones 0004 y 0005 aplicadas en `vitaltrain-dev` (156 ejercicios), pantalla de biblioteca del coach (buscar, filtrar por etiqueta, ver vídeo vertical, renombrar, etiquetar, indicaciones, archivar, añadir por enlace), franja gris de arriba corregida. Falta: publicar (depende de GitHub) y que Rubén lo pruebe
- [ ] Tareas 4-6 (hechas en local, pendientes de publicar y probar): constructor de plantillas por bloques; pacientes (lista, alta, ficha con semana, asignar, copiar semana, detalle registrado, notas del paciente, notas privadas, pausar o archivar); app del paciente (Hoy, Mi semana, Perfil, entrenamiento con series precargadas, descanso, vídeo vertical, nota y "no puedo", final con esfuerzo y sensaciones, modo sin conexión con cola de envío)
- [ ] Tarea 7 (hecha en local, pendiente de publicar y probar): programas de 1 a 12 semanas con regla de progresión, asignar desde un lunes y «Cambiar desde una semana». Migración 0007 aplicada en `vitaltrain-dev` (8 nov 2026)
- [ ] Tarea 8 (hecha en local, pendiente de publicar y probar): diseño a la carta desde la ficha del paciente. Crear sesión sin plantilla, repetir en varios días y semanas, partir de una plantilla, editar y duplicar sesiones, guardar como plantilla. El constructor por bloques es común (`src/modules/entrenamiento/constructor/Bloques.tsx`). Migración 0008 aplicada (8 nov 2026)
- [ ] Tarea 9 (hecha en local): consentimiento del paciente (pantalla al entrar, Privacidad en Perfil con retirar, estado en la ficha del coach). Texto 1.1-borrador con los datos del responsable (Rubén Úbeda Rubio, titular de la clínica; contacto info@vitaltrain.com). Pendiente: plazo de conservación y revisión del asesor
- [ ] Tarea 10 (hecha en local): «Cambiar un ejercicio» en la ficha del paciente. Migración 0010 aplicada (8 nov 2026)
- [ ] Tarea 11 (hecha en local): Mi progreso. Pestaña «Progreso» del paciente y sección «Progresión» en la ficha del coach (`src/modules/entrenamiento/progreso/Progreso.tsx`): esta semana, % de las últimas 4 semanas, esfuerzo medio, entrenamientos por semana (12 semanas), esfuerzo por semana y carga máxima por día de cada ejercicio. Sin tablas nuevas; gráficas en SVG propio, sin librerías (8 nov 2026)
- [ ] Tarea 12 (hecha en local): panel de inicio del coach (`src/core/coach/Inicio.tsx`): pacientes activos, sesiones de la semana, quién lleva 7 días o más sin entrenar, notas sin leer, «Necesitan atención» (sin consentimiento, sin entrenar, sesiones no hechas, sin plan pendiente, notas) y la semana de cada paciente en una tabla. Desde cualquier fila se abre su ficha. Sin tablas nuevas (8 nov 2026)
- [ ] Tarea 13 (hecha en local): Mis medidas (`src/core/medidas/Medidas.tsx`), en la pestaña Progreso del paciente y en la ficha del coach, con gráfica por medida. La gráfica de línea es común (`src/core/graficas.tsx`). Migración 0011 aplicada (8 nov 2026)
- [ ] Tarea 14 (hecha en local): mensajes. Pestaña Mensajes del paciente (5 pestañas) y sección Mensajes del coach con bandeja por paciente, no leídos, respuestas rápidas y contexto (última sesión, ver ficha). Se actualiza cada 15 s con la conversación abierta; aviso de no leídos en el menú cada 60 s. Aún sin aviso push ni email (8 nov 2026)
- [x] Revisión de seguridad independiente (8 nov 2026): ningún acceso a datos de otro paciente ni forma de saltarse el consentimiento. Corregidos los 4 fallos de pérdida o calidad de datos (0013 y app). Quedan anotados, de prioridad baja: exigir en la base de datos la versión vigente del consentimiento; limpiar colas viejas de otra cuenta en el móvil (no se hace: borraría datos sin autorización); alta de paciente que falla a medias. Fechas, longitudes y módulo activo al registrar entrenamiento resueltos en 0026 (0.21.1)
- [x] Versión de prueba en Cloudflare Pages subida a mano: https://vitaltrain-prueba.pages.dev (proyecto `vitaltrain-prueba`, sin GitHub). Cada versión nueva se sube como zip (8 nov 2026)
- [ ] Tarea 16 (hecha en local): ritmos circadianos. Panel solar por ciudad, sueño, comidas, indicadores del coach (regularidad, jet lag social, ventana de alimentación). Migración 0014 aplicada (8 nov 2026)
- [ ] Tarea 17 (hecha en local): hábitos por pilar y activación de módulos por paciente en la ficha. Migración 0015 aplicada (8 nov 2026)
- [ ] Tarea 18 (hecha en local): documentos por pilar. Migración 0016 aplicada (9 nov 2026)
- [ ] Tarea 19 (hecha en local): resumen mensual con conclusiones, compartir y PDF. Migración 0017 aplicada (9 nov 2026)
- [ ] Tarea 20 (hecha en local): historia clínica / CRM (fases A y B): consultas, ficha clínica, documentos clínicos, línea de tiempo, registro de accesos, doble factor, alta «solo historia». Migración 0018 aplicada y probada por Rubén con doble factor en vitaltrain-prueba 0.15.1 (9 nov 2026). Falta: `vitaltrain-prod`, importación desde OneDrive, exportación para el paciente
- [ ] Tarea 21 (hecha en local): avisos push y email, recordatorio de entrenamiento, descarga de datos. Migración 0019 y función `avisos` en dev (9 nov 2026). Verify JWT desactivado y 4 secretos puestos por Rubén; email de respaldo probado (9 nov 2026). Falta probar el push en iPhone instalado
- [ ] Tarea 22 (hecha en local): cuestionarios. rMEQ con cronotipo y check-in semanal con gráficas en la ficha y medias en el resumen mensual. Migración 0020 aplicada (9 nov 2026)
- [ ] Fase 1: las 17 funciones de la sección 3 hechas en local. Falta probar los avisos con las claves puestas
- [ ] Producción (9 nov 2026): organización Supabase «Vitaltrain Producción» (Pro) con el proyecto `vitaltrain-prod` (ref `idzbwtlnhlkxcnhfvxcp`, Frankfurt, Micro). Hecho: migraciones 0001-0021, altas libres desactivadas, código de 6 dígitos y 15 min, plantilla del email, SMTP Mailgun (contraseña puesta por Rubén), funciones `alta-paciente` y `avisos` con Verify JWT desactivado, cuenta de coach `ruben.ubeda@vitaltrain.com`. Cloudflare `vitaltrain-app`: «Production» apunta a prod y «Preview» a dev. DPA de Supabase incluido en sus condiciones (no se firma aparte). Doble factor activado en la cuenta de Supabase de Rubén. Avisos en prod: claves VAPID y del reloj generadas desde la app, 5 secretos puestos por Rubén (MAILGUN_API_KEY con una clave de envío propia «App Vitaltrain avisos producción»), reloj cada 15 min activo y probado (respuesta 200). Contraseña SMTP de acceso@vitaltrain.com cambiada en Mailgun el 9 nov y puesta en prod y dev; Rubén entró como coach en prod. Falta: doble factor del coach en prod, prueba con un paciente de prueba, DPA de Cloudflare y Mailgun, revisión del asesor
- [ ] Tarea 24: respiración guiada (0.18.0) y consentimiento 1.3-borrador. Migración 0021 aplicada (9 nov 2026)
- [ ] Tarea 27 (0.18.1): aceptación sencilla (frase + «Leer las condiciones» + «Acepto»), condiciones 1.4-borrador con bloqueo de 5 años propuesto, ficha del coach oculta los datos de la app si se retira el consentimiento. Aprobado por la asesora el 9 nov 2026 (versión 1.4, 0.18.2), igual que la EIPD breve del piloto y la entrada en el registro de actividades. Falta: revisar la cláusula del cuestionario de admisión (historia en la nube, Supabase como encargado)
- [ ] Tarea 29 (0.19.0): copia de la historia clínica para el paciente, borrado a los 5 años solo con autorización de Rubén (migraciones 0022 y 0023), protocolo de privacidad en Claude Docs. 0022 y 0023 aplicadas en dev y en prod (prod ejecutado por Rubén el 9 nov 2026; comprobado sin borrado automático ni reloj)
- [x] Doble factor del coach en prod y prueba completa con un paciente de prueba en prod: todo bien (9 nov 2026)
- [x] Tarea 31 (0.20.0): suscripciones de WooCommerce con aprobación del coach (9 nov 2026). 0024 en dev y en prod (ejecutada por Rubén), secreto `WOO_WEBHOOK_SECRET` y función `woocommerce` en prod (Verify JWT desactivado), webhooks en WooCommerce: «suscripción creada» (ID 2) y «suscripción actualizada» (ID 3), API v3. Productos: Comunidad 13847; Entrenamiento online 5726 (lo añade Rubén en Ajustes: entrenamiento, ritmos circadianos, mensajes). Las suscripciones ya existentes llegan a la app en su próxima renovación o cambio
- [x] Tarea 32 (0.21.0): módulo «Sol y vitamina D» y ubicación actual solo en el móvil. Fusionada (PR #15) y 0025 en dev y prod (10 nov 2026). Falta: confirmar con la asesora el texto sobre ubicación
- [x] Tarea 33 (0.21.1): ajustes de seguridad pendientes de la revisión del 8 nov (migración 0026). Fusionada (PR #16); 0026 en dev y prod tras comprobar que ningún paciente tenía sesiones sin el módulo de entrenamiento (10 nov 2026)
- [x] Tarea 34 (0.22.0): recordatorios de «Mi día» (migración 0027). Fusionada (PR #17); 0027 en dev y prod; función `avisos` desplegada en dev y prod con Verify JWT desactivado (10 nov 2026). Incluye el email mensual de borrados pendientes. Falta: probar el aviso en un iPhone instalado
- [ ] Tarea 36 (0.23.0): editor de cuestionarios de seguimiento (migración 0028). Aplicada en dev. Falta: fusionar y 0028 en prod
- [ ] FluentCRM: etiquetas por plan con automatizaciones de WooCommerce en la web. Lo configura Rubén
- [ ] Piloto de entrenamiento con 2-3 pacientes
- [ ] Migración de los 7 pacientes y baja de Harbiz
- [ ] Fase 2: circadiano y hábitos
