# Novedades

Qué ha cambiado en la app y cómo probarlo. Lo más reciente arriba. Escrito para Rubén, sin tecnicismos.

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
