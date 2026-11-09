# Conexión con WooCommerce

Rubén Úbeda Rubio, T.S.D. Sanitario Colegiado 2209 · Clínica Vitaltrain, Centro Sanitario Nº Registro 22433

Cuando alguien paga, renueva, pausa o cancela una suscripción en vitaltrain.com, WooCommerce avisa a la app. La app **solo guarda el aviso y te propone el cambio**. No abre ni cierra nada, no crea cuentas y no borra datos: todo lo aplicas tú desde el Inicio del panel.

## Cómo funciona

1. Alguien se suscribe o cambia su suscripción en la web.
2. WooCommerce envía un aviso firmado a la función `woocommerce` de Supabase.
3. La app lo guarda y lo enlaza con el paciente del mismo email, si existe.
4. En tu Inicio aparece «Suscripciones: cambios por revisar» con lo que propone abrir o cerrar.
5. Pulsas «Aplicar», ves el resumen y lo confirmas. Si no tiene cuenta, te lo dice y decides si darle de alta.

Cerrar un módulo no borra sus datos: el paciente deja de verlos y, si vuelve a pagar, aparecen de nuevo.

## Qué abre cada plan

Se edita en **Ajustes → Planes de WooCommerce**. De partida:

| Producto | Plan | Abre |
|---|---|---|
| 13847 | Comunidad | Ritmos circadianos, Hábitos, Cuestionarios |

Falta añadir el número del producto «Entrenamiento online» (y el del Completo de 79 € cuando exista).

## Puesta en marcha (lo hace Rubén, con su autorización en cada paso)

1. **Secreto compartido.** Inventa una frase larga y aleatoria (al menos 32 caracteres). Guárdala en tu gestor de contraseñas. No me la pases.
2. **Supabase → Edge Functions → Secrets:** añade `WOO_WEBHOOK_SECRET` con ese secreto.
3. **Desplegar la función `woocommerce`** (te la dejo preparada) y desactivar «Verify JWT».
4. **WordPress → WooCommerce → Ajustes → Avanzado → Webhooks → Añadir webhook**, dos veces:
   - Nombre: «App Vitaltrain · creada» y «App Vitaltrain · actualizada».
   - Estado: Activo.
   - Tema: «Suscripción creada» y «Suscripción actualizada».
   - URL de entrega: `https://idzbwtlnhlkxcnhfvxcp.supabase.co/functions/v1/woocommerce`
   - Secreto: el mismo del paso 1.
   - Versión de la API: WP REST API Integration v3.
5. **Prueba:** pon en pausa y reactiva una suscripción de prueba. En tu Inicio debe aparecer la propuesta.

## Qué datos se guardan

Solo el número de suscripción, el estado, el email de facturación, el producto y la fecha del próximo pago. Nunca direcciones, teléfonos ni datos de pago.
