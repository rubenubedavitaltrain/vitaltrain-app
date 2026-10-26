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
| Ritmos circadianos | Sueño, luz, horarios de comida, anclas del día | 2 |
| Hábitos | Protocolos diarios por pilar asignados por el coach | 2 |
| Cuestionarios | Cronotipo, check-in semanal PNI, cuestionarios de consulta | 3 |
| Aprendizaje | Contenidos por pilar (vídeo, texto), enlazables con la Escuela | 4 |
| Respiración y regulación | Ejercicios guiados con temporizador | 4 |
| Asistente IA | Borradores de rutinas y protocolos para revisión del coach | 5 |
| Wearables | Datos de sueño y actividad (Apple Health requiere app nativa vía Capacitor) | 5 |

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
14. Constructor de entrenamientos por bloques.
15. Programas de 1 a 12 semanas, con una regla de progresión por semana; al asignar se crean las sesiones en el calendario del paciente. En un programa en curso, "Cambiar desde una semana": se elige la semana (la actual o cualquier futura), se borran solo las sesiones pendientes desde ese lunes y se asigna en su lugar otro programa o semanas nuevas. Las sesiones hechas, en curso o con registros nunca se borran.
16. Mensajes: bandeja por paciente con contexto y respuestas rápidas.
17. Resumen mensual por paciente: adherencia, esfuerzo, cargas, medidas, notas; conclusiones del coach; PDF y compartir con el paciente.

## 4. Módulo de ritmos circadianos (detalle)

### Paciente
- **Perfil circadiano**: cronotipo (cuestionario rMEQ, 5 preguntas, Adan y Almirall 1991), días laborables y ciudad. Con la ciudad se calculan amanecer y atardecer reales de cada día (librería tipo `suncalc`, en el cliente; no se usa GPS).
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
| Entornos | `vitaltrain-dev` (Supabase Free, datos inventados) y `vitaltrain-prod` (Supabase Pro). Nunca desarrollar contra producción |
| Login | Código de 6 dígitos por email (OTP). No enlace mágico: en iOS abre Safari y no la PWA instalada. Solo el coach da de alta pacientes |
| Email | Mailgun como SMTP propio de Supabase. Dominio vitaltrain.com, ya en la región UE (smtp.eu.mailgun.org). Remitente propio para la app: acceso@vitaltrain.com |
| Calidad | Pruebas de seguridad de datos (RLS) y de pantallas en GitHub Actions. Un cambio no se publica si fallan |
| Vídeos | YouTube (canal no monetizado: sin anuncios), embed `youtube-nocookie.com` con rel=0. Bunny Stream opcional más adelante. Campo `video_provider` |
| Formato de vídeo | Los ejercicios son YouTube Shorts verticales (9:16), de 15-60 s. En el entrenamiento se muestra una miniatura y al tocarla se abre a pantalla completa en vertical. La importación acepta enlaces `youtube.com/shorts/<id>` y `youtu.be/<id>` |
| Cobro | WooCommerce en vitaltrain.com. La app no cobra. Webhook activa o pausa el acceso |
| Idioma | Solo español |
| Coaches | Uno (Rubén). El rol `coach` existe por si hay más en el futuro |

## 6. Identidad visual y tono

- Mostaza `#DBB732` (acento, botones principales)
- Verde petróleo oscuro `#384848` (cabeceras, navegación)
- Gris claro `#ECECEC` (fondos)
- Gris texto `#333333`
- Gris medio `#A8A8A8` (secundario, bordes)

Textos de la app: claros, directos, frases cortas, sin emojis ni lenguaje de marketing. Cada hábito explica su porqué en una o dos frases.
Diseño primero para móvil: botones grandes, poco texto, registro rápido.

## 7. Modelo de datos

- `supabase/migrations/0001_schema.sql`: núcleo de usuarios y módulo de entrenamiento.
  - `profiles` (un trigger impide que el paciente cambie su rol, estado o email), `coach_notes` (privadas).
  - `exercises`; `templates` → `template_blocks` → `template_items`.
  - `workouts` → `workout_blocks` → `workout_items` (copia al asignar), `set_logs`.
  - `checkins`, `messages`, `memberships`, `push_subscriptions`.
- `supabase/migrations/0002_plataforma_modular.sql`: núcleo modular y nuevos motores.
  - `pillars`, `modules`, `patient_modules`, `patient_settings`.
  - `habit_definitions`, `patient_habits`, `habit_logs`.
  - `sleep_logs`, `meal_events`.
  - `questionnaires`, `questionnaire_assignments`, `questionnaire_responses`.

- `supabase/migrations/0003_frases_pilares.sql`: frase de cada pilar.
- Pendiente, migración `0004` (Fase 1 ampliada), a diseñar al construir cada pantalla:
  - `workout_item_feedback`: nota y motivo de "no puedo hacerlo" por ejercicio asignado.
  - `programs` (duración 1-12 semanas), `program_weeks` (número, regla de progresión) y `program_slots` (semana, día, plantilla): programas de varias semanas.
  - `program_assignments` (paciente, programa, fecha de inicio, estado, semana en que se sustituyó, asignación que la sustituye). Asignar crea `workouts` como copia, igual que una plantilla, enlazados a la asignación y con su número de semana.
  - Función `replace_program_from_week(asignación, semana, nuevo programa o null)`: borra los `workouts` de esa asignación desde el lunes de esa semana que estén en estado `scheduled` y sin `set_logs`, cierra la asignación y crea la nueva. Solo el coach puede llamarla. Con pruebas de que nunca borra sesiones hechas ni registros.
  - `patient_documents` + bucket privado de Storage: PDFs por paciente y pilar.
  - `body_measurements`: peso, cintura, cadera, fecha. Sin fotos.
  - `consents`: versión del texto, aceptado, retirado.
  - `monthly_reviews`: mes, conclusiones del coach, compartido o no.
  - `patient_settings`: añadir hora del recordatorio y avisos activos.

Seguridad: Row Level Security en todas las tablas. El paciente solo ve lo suyo y solo escribe en módulos que tiene activos. El coach lo ve todo.

Pruebas de seguridad: `supabase/tests/rls.test.mjs` aplica todas las migraciones en un Postgres embebido y comprueba los permisos. Se ejecuta en GitHub Actions en cada cambio (`.github/workflows/seguridad-datos.yml`). Cada tabla o regla nueva añade sus pruebas ahí.

## 8. Marco legal y de datos

- Datos de salud: categoría especial (art. 9 RGPD). Todo alojado en la UE.
- No guardar diagnósticos ni historia clínica en la plataforma. La historia clínica sigue en su sistema actual.
- DPA firmado con Supabase y el hosting antes de meter pacientes reales. Revisión por el asesor de protección de datos.
- Producto sanitario: el software que genera de forma autónoma recomendaciones diagnósticas o terapéuticas puede considerarse producto sanitario (Reglamento UE 2017/745). Por eso la app no decide: muestra lo que el profesional pauta y registra lo que hace el paciente. Cualquier función de IA genera borradores para el coach, nunca recomendaciones directas al paciente. Validarlo con asesoría antes de la fase 5.
- Nunca usar datos reales en desarrollo. Claves solo en variables de entorno.

## 9. Reglas de trabajo para Claude Code

- Tareas pequeñas y comprobables. Cada una termina con algo que Rubén pueda probar en el móvil.
- Explicar los cambios en lenguaje llano: Rubén no es programador.
- Justificar cada dependencia nueva antes de instalarla.
- Cambios de base de datos siempre como migración nueva numerada.
- Respetar el contrato de módulo (sección 2). No mezclar código de un módulo en otro.
- No empezar un módulo nuevo hasta que el anterior esté en uso real por pacientes.
- Mantener actualizada la sección 10, `docs/DECISIONES.md` (fecha, decisión, motivo) y `docs/NOVEDADES.md` (qué cambió y cómo probarlo, en lenguaje llano).
- Cada propuesta de cambio explica en español llano qué hace, cómo probarlo en el móvil y qué podría fallar.
- La migración 0002 es diseño: aplicar ahora solo pilares, módulos y ajustes del paciente; el resto cuando se construya su módulo.
- Pendiente Fase 1: limitar qué columnas de `workouts` puede cambiar el paciente (solo estado, fechas de inicio y fin, esfuerzo, sensaciones y notas).

## 10. Estado actual

- [x] Especificación y modelo de datos del núcleo, entrenamiento, circadiano, hábitos y cuestionarios (oct 2026)
- [x] Pilares y su frase confirmados (26 oct 2026)
- [x] Auditoría de la propuesta (26 oct 2026): Cloudflare + React en vez de Vercel + Next.js, login por código, dos entornos, prototipo antes de código
- [x] Cuentas: GitHub, Supabase `vitaltrain-dev` (Frankfurt), Cloudflare, Mailgun en región UE (26 oct 2026)
- [x] Repositorio `rubenubedavitaltrain/vitaltrain-app` creado y app de Claude instalada (26 oct 2026)
- [ ] Subdominio app.vitaltrain.com (etapa 5)
- [x] Prototipo v1 (8 pantallas) revisado por Rubén (26 oct 2026)
- [x] Alcance de la Fase 1 ampliado a 17 funciones (26 oct 2026)
- [ ] Prototipo v2 (16 pantallas) aprobado
- [ ] Proyecto React creado y desplegado en Cloudflare Pages
- [ ] Login con código de 6 dígitos (Mailgun como SMTP)
- [ ] Fase 1: las 17 funciones de la sección 3
- [ ] Piloto de entrenamiento con 2-3 pacientes
- [ ] Migración de los 7 pacientes y baja de Harbiz
- [ ] Fase 2: circadiano y hábitos
