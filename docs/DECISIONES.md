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
