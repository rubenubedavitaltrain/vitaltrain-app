# Asistente del coach (Claude conectado a la app)

Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433

## Qué es
Claude se conecta a la app con la cuenta del coach (conector personalizado en Claude). Lee los datos de los pacientes y prepara propuestas: sesiones y planificaciones, cambios de ejercicio, mensajes y hábitos. Nada llega al paciente hasta que Rubén aprueba la propuesta, en la conversación con Claude o en el Inicio del panel («Propuestas del asistente»).

## Piezas
- Migración `0030_asistente.sql`: tabla `assistant_drafts` (propuestas), `aplicar_propuesta(id)` y `descartar_propuesta(id)`. Aplicar usa las mismas funciones que la app (`save_workout`, `replace_exercise`), así que respeta sus reglas. Las propuestas no se borran.
- Función `supabase/functions/asistente`: servidor MCP. Entra con el token OAuth del coach y trabaja con sus permisos (RLS). No usa la clave de servicio. Herramientas:
  - De lectura: `listar_pacientes`, `ficha_paciente`, `historia_clinica`, `calendario`, `buscar_ejercicios`, `catalogo_habitos` y `propuestas`.
  - Para proponer cambios: `proponer_sesiones`, `proponer_cambio_ejercicio`, `proponer_mensaje` y `proponer_habito`.
  - Para decidir: `aplicar_propuesta` y `descartar_propuesta`.
- Pantalla `/oauth/consent` (`src/core/asistente/Autorizar.tsx`): solo el coach, con doble factor, autoriza la conexión.
- `src/core/asistente/Propuestas.tsx`: propuestas pendientes en el Inicio del coach.

## Reglas
- La IA propone; Rubén decide (Reglamento UE 2017/745). Nunca recomendaciones directas al paciente.
- La historia clínica solo con doble factor. La conexión de Claude llega sin segundo factor, así que `historia_clinica` pide cada vez el código de la app de autenticación de Rubén (caduca en ~30 s); la función sube esa sesión a aal2 solo para esa consulta. Cada lectura queda en `access_log` con la entidad `asistente_ia`.
- Los datos de la app de pacientes sin consentimiento en vigor no se muestran al asistente.
- No hay registro dinámico de clientes: la app OAuth de Claude se da de alta a mano en Supabase (cliente público con PKCE y vuelta a `https://claude.ai/api/mcp/auth_callback`).

## Configuración por entorno
1. Aplicar 0030.
2. Desplegar la función `asistente` con «Verify JWT» desactivado. Comprobarlo después de cada despliegue.
3. En Authentication → OAuth Server: activar, con la ruta de autorización `/oauth/consent`. Dejar desactivadas las «Dynamic OAuth Apps».
4. En Authentication → OAuth Apps: crear «Claude · asistente Vitaltrain», como cliente público, con la redirección `https://claude.ai/api/mcp/auth_callback`.
5. El «Site URL» del proyecto tiene que ser la app de ese mismo entorno:
   - En dev: `https://tarea-39-asistente.vitaltrain-app.pages.dev`, puesto el 10 nov 2026.
   - En prod: `https://vitaltrain-app.pages.dev`, o `app.vitaltrain.com` cuando exista.
6. En Claude: Ajustes → Conectores → Añadir conector personalizado.
   - URL: `https://<ref>.supabase.co/functions/v1/asistente`.
   - Client ID: el de la app OAuth.

Dev: client ID `bd2d6876-b2d0-47b0-b5f9-38fe2f306a8f`.

## Antes de usarlo con pacientes reales (producción)
Visto bueno de la asesora a todo el 15 nov 2026.
- [x] EIPD ampliada y condiciones 1.5 (asistente de IA, Anthropic como encargado). Migración 0032.
- [x] Probado en dev con datos inventados: lectura, propuestas, aplicar y descartar, historia con doble factor (10 nov 2026).
- [ ] **Plan de Claude con contrato de encargado.** El DPA de Anthropic forma parte de sus Condiciones Comerciales: cubre Claude Team, Enterprise y la API. Los planes personales (Free, Pro, Max) no lo incluyen. Con pacientes reales, el conector se usa desde una cuenta Team (desde 2 puestos). Confirmarlo con la asesora si ella lo vio con el plan Max.

## Pasos en producción (los pulsa Rubén)
1. SQL Editor de `vitaltrain-prod`: ejecutar `0030_asistente.sql` y después `0032_condiciones_1_5.sql`.
2. Fusionar el PR del asistente. Cloudflare publica la app con la pantalla de autorización y las condiciones 1.5.
3. Edge Functions → crear `asistente` con el código de `supabase/functions/asistente/index.ts` → Deploy. Después, en Details, «Verify JWT» desactivado.
4. Authentication → OAuth Server: activar, ruta de autorización `/oauth/consent`, «Dynamic OAuth Apps» desactivado.
5. Authentication → OAuth Apps: crear «Claude · asistente Vitaltrain», tipo público, redirección `https://claude.ai/api/mcp/auth_callback`. Copiar el Client ID.
6. Authentication → URL Configuration: Site URL `https://vitaltrain-app.pages.dev`.
7. En Claude (cuenta Team): Ajustes → Conectores → Añadir conector personalizado.
   - Nombre: `Vitaltrain`.
   - URL: `https://idzbwtlnhlkxcnhfvxcp.supabase.co/functions/v1/asistente`.
   - Client ID: el del paso 5.
   - Al conectar, entra con la cuenta de coach y el doble factor.
8. Prueba corta: «lista mis pacientes». Después, una propuesta para el paciente de prueba, que apruebas y compruebas en su móvil.
