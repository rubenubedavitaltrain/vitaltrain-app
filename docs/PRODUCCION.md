# Puesta en marcha: producción

Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433

Qué hace falta para que entren pacientes reales. Hasta que esto esté hecho, la app solo se usa con datos inventados en `vitaltrain-dev`.

## Cómo quedan los dos entornos

| | Desarrollo | Producción |
|---|---|---|
| Base de datos | `vitaltrain-dev` (Supabase Free) | `vitaltrain-prod` (Supabase Pro, Frankfurt) |
| Datos | Inventados | Pacientes reales |
| Dirección de la app | Enlaces de prueba de cada cambio y vitaltrain-prueba.pages.dev | vitaltrain-app.pages.dev (después app.vitaltrain.com) |
| Copias de seguridad | No | Diarias (incluidas en Pro) |

En Cloudflare, el proyecto `vitaltrain-app` lleva las claves de producción en «Production» y las de desarrollo en «Preview». Así cada cambio se prueba con datos inventados y solo lo unido a main llega a los pacientes.

Al hacer el cambio, tu perfil de prueba deja de entrar en vitaltrain-app.pages.dev (vive en desarrollo). Para probar seguirás usando los enlaces de prueba.

## 1. Lo que haces tú (unos 30 minutos)

1. **Crear el proyecto.** En supabase.com: New project → nombre `vitaltrain-prod`, región **Central EU (Frankfurt)**, plan **Pro**. Guarda la contraseña de la base de datos en tu gestor de contraseñas. No me la pases.
2. **Firmar el DPA de Supabase.** Organization → Legal Documents → DPA. Descárgalo firmado y guárdalo con la documentación de la clínica.
3. **Activar el doble factor para tu cuenta de Supabase** (no la de la app): Account → Security. El proyecto tendrá historias clínicas.
4. **Decirme que está creado.** Desde aquí sigo yo con el punto 2.

## 2. Lo que hago yo, contigo mirando

Hecho el 9 nov 2026: todo este apartado, salvo la comprobación final con un paciente de prueba.


- Aplicar las migraciones 0001 a 0020 en orden y el reloj de avisos (`supabase/manual/reloj_avisos.sql`, con la dirección del proyecto nuevo).
- Ajustes de acceso: altas libres desactivadas, código de 6 dígitos que caduca en 15 minutos, plantilla del email en español, Mailgun como servidor de correo (la contraseña SMTP la pegas tú), doble factor TOTP activado.
- Desplegar las funciones `alta-paciente` y `avisos`, con «Verify JWT» desactivado (lo desactivas tú).
- Claves nuevas de avisos (no se reutilizan las de desarrollo) y `APP_URL` = la dirección de producción. Los secretos los pegas tú.
- Tu cuenta de coach: creas el usuario en Authentication con `ruben.ubeda@vitaltrain.com` y yo le doy el papel de coach con `supabase/manual/coach_inicial.sql`.
- Cloudflare: claves de producción en «Production» y de desarrollo en «Preview».
- Comprobación final: entrar como coach, doble factor, alta de un paciente de prueba con tu otro email, un entrenamiento, un mensaje y un aviso. Después se borra ese paciente.

## 3. Antes del primer paciente real

- [ ] DPA firmados: Supabase (punto 1), Cloudflare (incluido en sus condiciones; descargar copia), Mailgun (Settings → Data Processing Agreement).
- [x] Texto del consentimiento aprobado por la asesora (9 nov 2026): versión 1.4, con bloqueo de cinco años tras la baja.
- [ ] Cláusula informativa del cuestionario de admisión: decir que la historia clínica está en la nube (UE) con Supabase como encargado.
- [ ] Registro de actividades de tratamiento actualizado con la app (lo lleva el asesor).
- [ ] Evaluación de impacto (EIPD) breve antes del piloto (decidido con la asesora el 9 nov 2026). Ampliarla antes de abrir el plan gratuito al público.

## 4. Piloto (2-3 pacientes)

1. Alta de cada paciente desde el panel: nombre y email. Le llega el código al entrar.
2. En su ficha, «Qué ve en su app»: entrenamiento y mensajes (y lo que quieras sumar).
3. Su primera semana: desde cero en la ficha o con un programa.
4. Que instale la app: Safari → compartir (o ···) → «Añadir a pantalla de inicio». Que active los avisos en Perfil.
5. Una semana de uso y revisión contigo: qué falla, qué sobra, qué falta.

## 5. Dejar Harbiz

Cuando el piloto funcione: alta de los 7 pacientes, su plan en la app, y aviso a cada uno con fecha de cambio. Mantener Harbiz un mes en paralelo por si acaso y darlo de baja después.
