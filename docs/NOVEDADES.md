# Novedades

Qué ha cambiado en la app y cómo probarlo. Lo más reciente arriba. Escrito para Rubén, sin tecnicismos.

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
