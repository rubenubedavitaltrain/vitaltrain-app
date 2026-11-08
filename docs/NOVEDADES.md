# Novedades

Qué ha cambiado en la app y cómo probarlo. Lo más reciente arriba. Escrito para Rubén, sin tecnicismos.

## 2026-11-08 · Arreglo (versión 0.7.1)
- Al abrir la sesión de hoy en el móvil del paciente, la pantalla se quedaba en blanco. La base de datos entrega la nota de cada ejercicio como un dato suelto y la app esperaba una lista. Corregido en el entrenamiento del paciente, en el detalle de la sesión del coach y en «Cambiar desde una semana».
- Si en algún momento una pantalla falla, ahora sale un mensaje con «Volver a cargar» en vez de quedarse en blanco.
- Lo detectó la primera prueba real de Rubén. Las capturas de prueba usaban datos simulados con otro formato; ahora se simulan como llegan de verdad.

## 2026-11-08 · Tarea 9: consentimiento (versión 0.7.0)
- La primera vez que un paciente entra ve «Antes de empezar»: lo esencial sobre sus datos, un enlace a la información completa y dos casillas. Hasta que no acepta, no ve nada más.
- «No acepto» le explica que sin consentimiento la app no puede guardar sus datos y que hable contigo.
- Perfil → Privacidad: versión y fecha aceptadas, el texto completo y «Retirar mi consentimiento».
- La protección está en la base de datos, no solo en la pantalla: sin consentimiento en vigor el paciente no puede leer ni registrar nada, aunque use otra app o un truco.
- En tu ficha del paciente aparece si lo ha aceptado, si está pendiente o si lo ha retirado.
- Si cambias el texto, se sube la versión y cada paciente tendrá que aceptarlo de nuevo.
- El texto es un **borrador** (1.0-borrador): faltan razón social, NIF, código postal, email de privacidad y el plazo de conservación, y debe revisarlo tu asesor. Copia para él en `docs/legal/consentimiento.md`.
- Base de datos: migración 0009 aplicada en `vitaltrain-dev`.
- Cómo probarlo: entra como tu paciente de prueba. Debe salir la pantalla de consentimiento. Acepta, entrena, y luego retíralo en Perfil: el plan debe dejar de verse y volver a pedirte el consentimiento.
- Qué podría fallar: si el paciente retira el consentimiento con registros sin enviar en el móvil, esos registros no se guardarán.

## 2026-11-08 · Tarea 8: diseño a la carta (versión 0.6.0, pendiente de publicar)
- En la ficha del paciente, cada día tiene **«+ Crear sesión»**. Se abre el constructor por bloques a pantalla completa y la sesión se guarda solo para ese paciente. No hace falta crear una plantilla.
- **Repetir**: eliges los días de la semana (por ejemplo lunes y jueves) y cuántas semanas (1 a 12). Te dice cuántas sesiones se crearán y en qué fechas. Los días ya pasados no se incluyen.
- **Partir de una plantilla** (opcional): carga sus ejercicios y los ajustas para ese paciente.
- **Guardar también como plantilla**: por si quieres reutilizar esa sesión con otro paciente.
- Al tocar una sesión del calendario: **Editar sesión** (si está pendiente y sin nada registrado por el paciente) y **Duplicar** (crea otra a partir de ella, aunque ya esté hecha).
- En el constructor: el nuevo ejercicio copia series, repeticiones y descanso del anterior del bloque, botón ⇄ para cambiar un ejercicio por otro manteniendo sus datos y botón ⧉ para duplicar un bloque.
- «+ De plantilla» sigue disponible para asignar una plantilla tal cual.
- Base de datos: migración 0008 aplicada en `vitaltrain-dev`.
- Cómo probarlo (cuando esté publicada): abre tu paciente de prueba, pulsa «+ Crear sesión» el lunes, añade tres ejercicios, marca lunes y jueves durante 4 semanas y crea. Luego abre una de esas sesiones, edítala y comprueba que la otra no cambia.
- Qué podría fallar: si el paciente tiene la sesión abierta sin conexión y ha registrado series que aún no se han enviado, y tú la editas a la vez, esas series no podrán guardarse. Por eso solo se edita lo que está pendiente; en caso de duda, duplica.

## 2026-11-08 · Tarea 7: programas (versión 0.5.0, pendiente de publicar)
- **Programas** (panel del coach → Programas): de 1 a 12 semanas. En una tabla eliges qué plantilla toca cada día de cada semana. Botón para repetir los días de la semana 1 en todas.
- **Regla de progresión por semana**: subir o bajar la carga entre -40 % y +20 % (se redondea a 0,5 kg) y una nota que el paciente verá en las sesiones de esa semana. Ejemplo: semana 4 a -30 % con la nota «Semana de descarga».
- **Asignar** (ficha del paciente → Programa): eliges programa, el lunes de inicio y un mensaje. Se crean todas las sesiones en su calendario.
- **Cambiar desde una semana**: eliges la semana (la actual o una futura) y otro programa o ninguno. Antes de confirmar te dice cuántas sesiones se quitan y cuántas se quedan. Nunca se borran sesiones hechas, en curso o con series o notas registradas.
- El paciente ve en Hoy y en Mi semana «nombre del programa · semana 3 de 8».
- Editar un programa no cambia lo ya asignado: cada asignación es una copia.
- Base de datos: migración 0007 aplicada en `vitaltrain-dev`.
- Cómo probarlo (cuando esté publicada): crea dos plantillas, haz un programa de 4 semanas con la semana 4 a -30 %, asígnalo a tu paciente de prueba desde este lunes, haz una sesión desde el móvil y luego usa «Cambiar desde una semana» en la semana 2. La sesión hecha debe seguir ahí.

## 2026-11-08 · Tareas 4, 5 y 6 (versión 0.4.0, pendiente de publicar)
- **Plantillas por bloques** (panel del coach → Plantillas): bloques normales, superseries y circuitos con vueltas. En cada ejercicio, series, repeticiones o tiempo, carga, descanso e indicación para el paciente.
- **Pacientes** (panel del coach → Pacientes): dar de alta con nombre y email (entra con código), pausar o archivar, y la ficha con:
  - su semana de entrenamiento: asignar una plantilla a un día con un mensaje, copiar la semana anterior, ver lo que ha hecho serie a serie y quitar sesiones pendientes;
  - las notas y avisos de «No puedo hacerlo» que deja en cada ejercicio;
  - tus notas privadas.
- **App del paciente**:
  - Hoy: el entrenamiento del día con tu mensaje, la semana en puntos y los pilares (los que no tiene activos, en gris).
  - Mi semana.
  - Entrenamiento: vídeo vertical, series con repeticiones y kilos ya rellenos, marcar cada serie, temporizador de descanso con +15 s y saltar, nota a Rubén y «No puedo hacerlo» con motivo.
  - Final: esfuerzo de 1 a 10, sensaciones y notas.
  - Sin conexión: el entrenamiento abierto sigue funcionando y lo registrado se envía solo al volver la red.
- Base de datos: migración 0006 aplicada en `vitaltrain-dev` y función `alta-paciente` instalada.
- Cómo probarlo (cuando esté publicada): crea una plantilla, da de alta un paciente de prueba con tu email +paciente, asígnale la plantilla hoy y entra como ese paciente desde el móvil.

## 2026-11-08 · Tarea 3 (versión 0.3.0, pendiente de publicar)
- Biblioteca de ejercicios en el panel del coach, con los 156 Shorts de tu canal ya cargados.
- Buscar por nombre, músculo o material. Filtrar tocando una etiqueta.
- Al tocar un ejercicio se abre su vídeo en vertical y puedes cambiar el nombre, poner grupos musculares, material e indicaciones para el paciente.
- «Archivar» lo quita de la biblioteca sin borrarlo. Se recupera con «Ver archivados».
- «Añadir ejercicio»: pegas el enlace del Short y la app propone el nombre del vídeo.
- Arreglada la franja gris que salía arriba en el iPhone.
- Cómo probarlo (cuando esté publicada): entra como coach, abre Biblioteca, busca «sentadilla», abre una y ponle etiquetas. Luego añade un Short nuevo pegando su enlace.
- Base de datos: migraciones 0004 y 0005 ya aplicadas en `vitaltrain-dev`.

## 2026-11-08 · Tarea 2 (versión 0.2.0)
- Pantalla de acceso: escribes tu email, te llega un código de 6 dígitos y entras. Sin contraseñas.
- Solo entra quien Rubén ha dado de alta. Si escribe un email sin acceso, la app lo dice.
- Tras entrar: saludo con tu nombre, los cinco pilares con su frase (leídos ya de la base de datos) y botón de cerrar sesión.
- Base de datos de pruebas (`vitaltrain-dev`) con las tablas de usuarios, entrenamiento, pilares y módulos. Sin datos de pacientes reales.
- Cómo probarlo: abre la app en el móvil, escribe tu email, mira el código en tu correo y escríbelo. Debe saludarte como coach.
- Probado por Rubén en su iPhone el 8 de noviembre: entra con código y ve el saludo de coach y los pilares.

## 2026-10-26 · Tarea 1
- Primera versión de la app: una pantalla de bienvenida con los cinco pilares y las instrucciones para instalarla en el móvil.
- Icono con el símbolo de Vitaltrain en mostaza sobre verde petróleo, logotipo de Vitaltrain en la cabecera y tipografía Figtree.
- Cómo probarlo: abre el enlace de prueba en el móvil y añádelo a la pantalla de inicio. Debe abrirse como una app, sin la barra del navegador.

## 2026-10-26
- Prototipo ampliado a 16 pantallas: mensajes, progreso, perfil, documentos, medidas, programas y resumen mensual. Todavía es diseño, no app.
- Repositorio creado con la especificación, el modelo de datos, el registro de decisiones y las pruebas de seguridad.
- Cada cambio pasa ahora 12 pruebas automáticas que comprueban que un paciente no puede ver ni tocar datos de otro. Las verás como una marca verde en GitHub.
- Especificación, modelo de datos y pruebas de seguridad preparados. Todavía no hay app que probar.
