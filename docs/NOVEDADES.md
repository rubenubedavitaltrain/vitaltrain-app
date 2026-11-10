# Novedades

Qué ha cambiado en la app y cómo probarlo. Lo más reciente arriba. Escrito para Rubén, sin tecnicismos.

## 2026-11-10 · Todo en producción (0.21.0 a 0.22.0)
- Publicadas en vitaltrain-app.pages.dev las versiones 0.21.0 (Sol y vitamina D, ubicación actual), 0.21.1 (ajustes de seguridad) y 0.22.0 (recordatorios de «Mi día»).
- Migraciones 0025, 0026 y 0027 ejecutadas por Rubén en producción. Antes de la 0026 se comprobó que ningún paciente tenía sesiones sin el módulo de entrenamiento.
- Función `avisos` desplegada en pruebas y en producción.

## 2026-11-10 · Recordatorios de «Mi día» (versión 0.22.0)
- **Paciente, Mi ritmo → Mi día**: cada hábito pautado con un momento del día (al despertar, al amanecer, antes de la última comida...) tiene un botón **«Avisarme»**.
  - El aviso llega al móvil a esa hora, solo los días que toca el hábito y solo si aún no lo ha marcado.
  - La hora sale de sus datos: su media de sueño y comidas, o el sol de su ciudad. Si su media cambia, la hora del aviso se ajusta sola al abrir Mi día.
  - Para el amanecer y el atardecer se usa la ciudad guardada, nunca la ubicación del móvil.
  - Lo decide el paciente. Tú no lo activas por él, pero en su ficha (Hábitos) ves «aviso a las 07:40».
  - Solo aviso en el móvil, sin email, para no saturar.
- Arreglo: una prueba de seguridad del sueño fallaba si se ejecutaba de madrugada. Ya no depende de la hora.
- Por dentro: migración 0027, aplicada en `vitaltrain-dev`. La función `avisos` hay que volver a desplegarla (también lleva el email mensual de borrados).
- Cómo probarlo: con un paciente de prueba que tenga hábitos y ritmos circadianos, asígnale «Luz natural al despertar». En el móvil (app instalada): Mi ritmo → Mi día → «Avisarme» en ese hábito.
- Qué podría fallar: si el paciente no tiene datos de sueño, el hábito no tiene hora y no aparece el botón hasta que anote unas noches.

## 2026-11-09 · Ajustes de seguridad pendientes (versión 0.21.1)
- Tres arreglos de prioridad baja que quedaron anotados en la revisión de seguridad del 8 de noviembre. **No borra ni cambia ningún dato existente.**
  - Para registrar entrenamiento (series, notas por ejercicio, terminar una sesión) el paciente necesita tener activo el módulo de entrenamiento. Su historial lo sigue viendo igual.
  - El paciente no puede poner fechas de inicio o fin de sesión en el futuro.
  - Límites de longitud: sensaciones 500 caracteres, notas de sesión 2000, notas privadas del coach 4000. Solo para lo que se escriba a partir de ahora.
- Por dentro: migración 0026, aplicada en `vitaltrain-dev`. En producción la ejecutas tú cuando lo revises.
- Cómo probarlo: con un paciente de prueba que tenga entrenamiento, haz una sesión entera en el móvil. Debe funcionar igual que antes.
- Qué podría fallar: un paciente sin el módulo de entrenamiento que tenga sesiones asignadas ya no podrá registrarlas. Las altas normales lo activan siempre.

## 2026-11-09 · Módulo «Sol y vitamina D» y ubicación actual (versión 0.21.0)
- **Módulo nuevo «Sol y vitamina D»** (pilar Contacto con la naturaleza), para el plan gratuito y los pacientes de consulta. Se activa por paciente en «Qué ve en su app».
  - **Paciente, Hoy**: tarjeta con amanecer, ventana de vitamina D y atardecer. «Ver más» abre el panel solar completo: altura del sol, ventanas UVA y UVB, vitamina D y su año.
  - No registra nada: todo se calcula en el móvil. Si el paciente tiene también ritmos circadianos, no sale repetido.
- **Usar mi ubicación actual** (en el sol y en ritmos circadianos): calcula el sol con la posición real del móvil.
  - La ubicación se queda **solo en ese móvil**, redondeada a unos 1 km. No se envía ni se guarda en el servidor y se borra al cerrar sesión.
  - Si elige una ciudad, deja de usarse la ubicación.
  - Cambio de seguridad: la app ya puede pedir la ubicación, pero solo para sí misma. Ninguna web externa puede.
- Por dentro: lo común (cálculo solar, ciudades, panel y selector) pasa al núcleo (`src/core/sol/`). Migración 0025, aplicada en `vitaltrain-dev`.
- Cómo probarlo: en el enlace de prueba, activa «Sol y vitamina D» a un paciente de prueba. En el móvil: Hoy → Ver más → Elegir dónde estoy → «Usar mi ubicación actual» y acepta el permiso.

## 2026-11-09 · Suscripciones de WooCommerce, con tu aprobación (versión 0.20.0)
- WooCommerce avisa a la app cuando alguien paga, renueva, pausa o cancela. **La app no cambia nada sola.**
- **Coach, Inicio → «Suscripciones: cambios por revisar»**: qué propone abrir o cerrar a cada paciente según su plan, con un botón «Aplicar» que pide confirmación. También quién ha pagado y aún no tiene cuenta.
- **Coach, Ajustes → «Planes de WooCommerce»**: qué módulos abre cada producto. Comunidad (13847) ya está: ritmos circadianos, hábitos y cuestionarios.
- Cerrar un módulo no borra datos.
- Solo se guarda el estado de la suscripción, el email, el producto y la fecha del próximo pago. Nada de pagos ni direcciones.
- Por dentro: migración 0024 (aplicada en `vitaltrain-dev`) y función `woocommerce` (firma verificada con un secreto compartido). Guía: `docs/WOOCOMMERCE.md`.
- Cómo probarlo: en el enlace de prueba, Ajustes → Planes de WooCommerce: debe salir Comunidad con sus tres módulos marcados.

## 2026-11-09 · Doble factor desde Ajustes (versión 0.19.1)
- **Coach, Ajustes**: arriba sale «Historia clínica protegida». Ahí configuras el doble factor sin abrir la historia de ningún paciente. Una vez hecho, pone «Doble factor activo».
- Por qué: antes solo se configuraba al abrir una historia, y eso deja un registro clínico en ese paciente.
- **Migraciones 0022 y 0023 aplicadas en producción** por Rubén. Comprobado: borrado autorizado 1, borrado automático 0, reloj 0.
- Cómo probarlo: en vitaltrain-app.pages.dev, Ajustes → «Configurar» → escanea el QR con la app de autenticación → escribe el código.

## 2026-11-09 · Copia de la historia para el paciente y borrado a los cinco años (versión 0.19.0)
- **Coach, historia clínica → «Copia para el paciente»**: documento legible con la ficha, las consultas cerradas con sus adendas y la lista de documentos clínicos. Botón «PDF» → «Guardar como PDF». Los borradores no salen. Queda anotado en el registro de accesos.
  - Es lo que hay que entregar si un paciente pide su historia (tienes un mes).
  - «Exportar datos» sigue ahí: es el archivo completo, más técnico.
- **Borrado solo con tu autorización**: la app nunca borra sola. Cuando alguien lleve más de cinco años de baja o con el consentimiento retirado, aparece en tu Inicio, en «Datos bloqueados hace más de cinco años». Solo se borra si pulsas «Revisar y borrar» y lo confirmas, paciente por paciente.
  - Antes te llega un **email pidiéndote autorización**, una vez al mes mientras haya alguno pendiente. Te dice qué norma se aplica (art. 32 LOPDGDD y apartado 6 de las condiciones) y qué deberías comprobar.
  - Para autorizar tienes que marcar «He comprobado que con este paciente no hay ninguna reclamación ni proceso abierto» y confirmar.
  - Solo sale con la sesión de doble factor.
  - Nunca toca la historia clínica ni tu cuenta de coach.
  - Si el paciente no tiene historia ni documentos, se borra también su cuenta.
  - Cada borrado queda registrado con tu autorización, sin datos de salud.
- **Fecha de baja**: al archivar un paciente se apunta la fecha sola. Si lo reactivas, se quita.
- Por dentro: migraciones 0022 y 0023 y la función `avisos` actualizada. En `vitaltrain-prod` las ejecuta Rubén cuando lo autorice.
- **Protocolo de privacidad** (documento aparte): qué hacer si un paciente pide sus datos, si hay una brecha o si escribe la AEPD.
- Cómo probarlo: en el enlace de prueba, abre la historia de un paciente de prueba → «Copia para el paciente» → «PDF».

## 2026-11-09 · Condiciones aprobadas (versión 0.18.2)
- La asesora de protección de datos ha aprobado las condiciones. Pasan a la **versión 1.4** (sin «borrador»).
- Quedan aprobados: el bloqueo de cinco años tras la baja, YouTube aceptado con el mismo botón y la pantalla sencilla de aceptación.
- Los pacientes de prueba verán otra vez la pantalla de aceptar al entrar, porque cambia la versión.

## 2026-11-09 · Aceptación de condiciones más sencilla (versión 0.18.1)
- **Paciente, al entrar**: ya no hay casillas ni listado. Ve una frase corta, el enlace **Leer las condiciones** (abre el texto completo) y el botón **Acepto**. Debajo, «No acepto».
- Condiciones **1.4-borrador**:
  - Plazo propuesto: si se da de baja o retira el consentimiento, sus datos de la app quedan bloqueados cinco años y después se borran. Pendiente del visto bueno de la asesora.
  - Quitada la frase de mayoría de edad.
  - YouTube: dice que guarda un identificador en el navegador y que, al aceptar, se aceptan también los vídeos.
- **Coach, ficha**: si un paciente retira el consentimiento, sus datos de la app se ocultan con el aviso «Datos de la app bloqueados». Siguen visibles la historia clínica y tus notas privadas.
- Como cambia la versión, quien ya hubiera aceptado lo verá otra vez al entrar.
- Cómo probarlo: en el enlace de prueba, entra con el paciente de prueba. Toca «Leer las condiciones», vuelve y toca «Acepto».

## 2026-11-09 · Respiración guiada y guía de producción (versión 0.18.0)
- Módulo nuevo **Respiración guiada** (pilar Regulación emocional). Se activa por paciente en «Qué ve en su app».
- **Paciente, Hoy**: tarjeta «Respiración» con los minutos de la semana y el botón «Respirar ahora».
  - Tres pautas: respiración lenta (5,5 s y 5,5 s, unas 5-6 por minuto), suspiro fisiológico (dos inspiraciones y una espiración larga) y 4-7-8 (con aviso de parar si se marea).
  - Elige duración, y si quiere dice cómo está antes y después (de 1, muy tenso, a 5, muy tranquilo).
  - Pantalla completa con un círculo que crece y se encoge al ritmo de cada fase. Sonido suave opcional en cada cambio. La pantalla no se apaga durante la sesión.
  - En iPhone no hay vibración: Safari no la permite. En Android sí.
- **Coach, ficha → Respiración guiada**: minutos por semana (8 semanas), pautas usadas y el cambio medio de calma antes y después.
- Va aparte del hábito «Respiración lenta»: si se lo pautas como hábito, lo marca él. Unirlos sería mezclar dos módulos; queda para más adelante, en el núcleo.
- **Consentimiento 1.3-borrador**: ahora nombra los cuestionarios y las sesiones de respiración. Quien entre tendrá que aceptarlo de nuevo.
- **Guía de producción** en `docs/PRODUCCION.md`: qué haces tú, qué hago yo, requisitos legales, piloto y baja de Harbiz.
- Por dentro: migración 0021 (`breathing_sessions`). Aplicada en `vitaltrain-dev`.
- Cómo probarlo: en la ficha del paciente de prueba activa «Respiración guiada». En el móvil, Hoy → Respirar ahora → 1 minuto de 4-7-8.

## 2026-11-09 · La app instalada se actualiza sola (versión 0.17.1)
- Problema: en Safari se veía la versión nueva, pero la app de la pantalla de inicio seguía en la antigua. En iPhone esa app casi nunca se abre de cero: vuelve de segundo plano, y solo buscaba versión nueva al abrirse de cero.
- Ahora busca versión nueva también cada vez que vuelve a primer plano y cada 30 minutos. Si la hay, se instala y la app se recarga sola.
- Nunca se recarga con un entrenamiento abierto: espera a que se cierre.
- En Perfil, abajo, botón **Buscar actualización**: dice si tienes la última o si hay una nueva.
- Cómo probarlo: esta vez, cierra la app del todo una vez (desliza hacia arriba desde la barra inferior y quítala de la lista de apps abiertas) y ábrela; abajo en Perfil debe poner 0.17.1. Desde esta versión, las siguientes llegarán solas.

## 2026-11-09 · Cuestionarios: cronotipo y check-in semanal (versión 0.17.0)
- Módulo nuevo **Cuestionarios**. Se activa por paciente en su ficha, «Qué ve en su app».
- **Coach, ficha del paciente → Cuestionarios**: marcas qué tiene que responder.
  - **Tu cronotipo** (rMEQ, 5 preguntas, Adan y Almirall 1991): una vez. Al responder, la app calcula la puntuación (4-25) y guarda el cronotipo. Lo ves en la ficha y en Ritmos circadianos.
  - **Tu semana** (check-in semanal): sueño, energía, digestión, estrés y dolor del 1 al 5, y una nota opcional. Le aparece cada semana en Hoy hasta que lo responde. Ves la evolución de cada escala en gráficas y sus notas.
- **Paciente, Hoy**: tarjeta «Cuestionarios» con lo pendiente. Responde tocando opciones; no se envía si falta alguna. Tras el rMEQ ve su cronotipo con una frase de qué significa. En Mi ritmo aparece su cronotipo.
- **Resumen mensual**: nuevo bloque «Cómo ha ido cada semana» con la media del mes de cada escala y las notas. Los resúmenes ya guardados no cambian.
- **Descargar mis datos** incluye ahora los cuestionarios respondidos.
- La app no interpreta ni recomienda nada a partir del cuestionario: solo calcula la puntuación publicada y te la muestra.
- Por dentro: migración 0020 (cuestionarios, asignaciones y respuestas; la base de datos comprueba cada respuesta y calcula la puntuación; el paciente no puede cambiar lo enviado). Aplicada en `vitaltrain-dev`.
- Cómo probarlo: sube el zip. En la ficha del paciente de prueba activa «Cuestionarios» en «Qué ve en su app» y marca los dos. En su móvil, Hoy → responde los dos. Vuelve a la ficha: verás el cronotipo y el primer punto de las gráficas.
- Qué podría fallar: el check-in cuenta la semana de lunes a domingo; si lo responde el domingo por la noche, el lunes ya le pedirá el siguiente.

## 2026-11-09 · Avisos probados e instrucciones de instalación para iPhone nuevos (versión 0.16.1)
- Rubén ha recibido el email de respaldo de un mensaje: los avisos por email funcionan.
- Corregido en la función `avisos`: si un email no salía (por ejemplo, sin la clave de Mailgun), bloqueaba los siguientes durante 30 minutos. Ahora se reintenta con el siguiente mensaje.
- Las instrucciones para instalar la app en iPhone explican el menú de tres puntos (···) de Safari en las versiones nuevas de iOS.

## 2026-11-09 · Avisos en el móvil y por email (versión 0.16.0)
- **Paciente, Perfil → Avisos**: «Activar avisos en este móvil», avisos de mensajes de Rubén (si no tiene avisos en el móvil, le llega un email) y **recordatorio de entrenamiento** a la hora que elija, solo los días que tiene sesión y no la ha hecho.
- **Coach, Ajustes**: activar avisos en tu ordenador o móvil (te avisa cuando un paciente escribe; si no, te llega un email) y **Claves de los avisos** (se configuran una vez).
- Los avisos nunca llevan el texto del mensaje: solo «Tienes un mensaje nuevo». Pasan por servidores de Apple y Google.
- En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o posterior). La app lo explica.
- Tocar un aviso de mensaje abre la app en la pestaña Mensajes.
- Por dentro: migración 0019 (ajustes de avisos, dispositivos, registro de avisos enviados), función de servidor `avisos` desplegada en `vitaltrain-dev` y un reloj que cada 15 minutos lanza los recordatorios (`supabase/manual/reloj_avisos.sql`, aplicado).
- **Lo que falta, de Rubén** (10 minutos):
  1. En Supabase → Edge Functions → avisos → Settings, desactivar «Verify JWT with legacy secret» y guardar (como en alta-paciente).
  2. En la app, Ajustes → «Generar claves». Copiar los tres secretos y pegarlos en Supabase → Edge Functions → Secrets.
  3. Añadir allí `MAILGUN_API_KEY` con la clave de envío de Mailgun.
- Cómo probarlo: en el móvil del paciente de prueba, Perfil → «Activar avisos en este móvil». Desde tu panel, escríbele un mensaje: le debe llegar el aviso.

## 2026-11-09 · Vitamina D en el panel solar (versión 0.15.2)
- En Mi ritmo, bajo las ventanas UVA y UVB, un bloque **Vitamina D**: la ventana del día y cuánto dura, el índice UV máximo estimado con cielo despejado, cuántos días quedan con ventana (o cuándo vuelve) y una gráfica del año con las horas de ventana de cada mes en su ciudad. Así se ve de un vistazo en qué meses no se fabrica vitamina D.
- Para Llíria hoy: 11:20 a 14:14 (2 h 55), UV 3 con cielo despejado, 15 días con ventana; desde el 24 de noviembre no hay ventana hasta finales de enero.
- El UV es una estimación por la altura del sol (fórmula de Madronich); con nubes será menor. La app no dice cuánto tiempo tomar el sol ni si suplementar: eso lo pautas tú.
- Cómo probarlo: sube el zip, abre Mi ritmo y pasa días con las flechas para ver cómo cambia.

## 2026-11-09 · La actualización automática, completa (versión 0.15.1)
- Con la 0.15.0 subida, el navegador seguía en la 0.13.0: la versión nueva quedaba «esperando» porque la página antigua no sabía activarla.
- Ahora la versión nueva se activa sola nada más descargarse, venga de la versión que venga. La siguiente vez que se abra la app, ya está al día.
- En los dispositivos que se queden atascados en una versión antigua basta con cerrar todas las pestañas de la app (o la app instalada) y volver a abrirla una vez.

## 2026-11-09 · Mi día, descarga de datos y consentimiento 1.2 (versión 0.15.0)
- **Mi día** (en Mi ritmo): la línea temporal de hoy del paciente. Su hora media de levantarse y acostarse, primera y última comida, amanecer, ventana UVB y atardecer de su ciudad, y los hábitos que le has pautado con un momento («Luz natural al despertar», «Cenar pronto»…) colocados a su hora. Marca «Lo siguiente».
- Las horas de sueño y comidas son su media de las últimas dos semanas: si aún no ha anotado, esos hábitos esperan y se avisa.
- **Descargar mis datos** y **consentimiento 1.2-borrador**: ver la entrada de la 0.14.0 (se publican en esta versión).
- **Próximas revisiones** en Inicio: según la «Próxima revisión» de la última consulta de cada paciente, las de las próximas tres semanas y las que se han pasado (en amarillo). Necesita haber entrado con el segundo código.
- Corregido por dentro: la comprobación de tipos dejaba archivos .js junto al código. Se han borrado y ya no se generan.
- Cómo probarlo: sube `vitaltrain-app-0.15.0-para-cloudflare.zip`. Al entrar como paciente pedirá aceptar el consentimiento nuevo. En Hoy → «Ver más» aparece «Mi día».

## 2026-11-09 · Documentos, resumen mensual e historia clínica (versión 0.14.0)

**Documentos (para el paciente)**
- En la ficha del paciente, sección **Documentos**: arrastras un PDF (plan de alimentación, protocolo…), eliges el pilar, pones una nota si quieres y decides si lo ve ya.
- El paciente lo encuentra en **Perfil → Mis documentos**, agrupado por pilar y con la etiqueta «Nuevo» la primera semana.
- Los archivos van a un almacén privado: solo los abren ese paciente y tú, con un enlace que caduca en una hora.

**Resumen mensual**
- En la ficha, **Resumen mensual → Abrir resumen**. Calcula el mes: sesiones hechas y adherencia, esfuerzo medio, cargas de inicio y final por ejercicio, notas en ejercicios, cómo se sintió, medidas, sueño y horarios, y el % de cada hábito.
- Escribes tus **conclusiones** y los **objetivos** del mes siguiente. «Guardar y compartir» hace que el paciente lo vea en **Progreso → Mis resúmenes del mes**.
- **PDF**: pulsa «PDF» y elige «Guardar como PDF». Sale en A4 con la marca y tus datos de colegiado.
- Las cifras se guardan como foto fija al guardar. Si luego el paciente anota algo de ese mes, «Actualizar cifras» y guardar otra vez.

**Historia clínica (CRM de pacientes)**
- Botón **Historia clínica** arriba en la ficha de cada paciente. Pide un **segundo código** de una app de autenticación del móvil (Google Authenticator, Microsoft Authenticator o la de contraseñas del iPhone). La primera vez escaneas un QR; después, solo el código.
- **Línea de tiempo**: todo el recorrido del paciente en orden: consultas, adendas, documentos clínicos, documentos compartidos, resúmenes, hábitos y programas pautados, entrenamiento por semanas, medidas y consentimiento. Filtro «Solo clínica» / «Solo app».
- **Consultas**: fecha, presencial / online / teléfono, duración, motivo, cómo está y evolución, valoración, pautas, objetivos y próxima revisión. Mientras escribes, a la derecha ves las pautas y objetivos de la consulta anterior. Se guarda como borrador; al **cerrarla** ya no se puede cambiar y las correcciones van como **adenda** fechada.
- **Ficha clínica**: motivo de consulta, antecedentes personales y familiares, medicación, suplementación, alergias, estilo de vida y observaciones. Cada cambio guarda la versión anterior.
- **Documentos clínicos**: PDF, fotos o Word, varios a la vez, en las mismas carpetas que usas en OneDrive (Análisis, Cuestionarios, Estudio metabólico, Plan de alimentación, Tratamientos, Test, Informes). El paciente no los ve. Solo se pueden borrar en las 24 horas siguientes a subirlos.
- **Registro de accesos**: quién abrió o cambió la historia y cuándo. No se puede editar ni borrar.
- **Alta «Solo historia clínica»**: para pacientes de consulta que no usan la app. Quedan en pausa y sin módulos; se les activa la app cuando quieras.
- Un paciente con historia no se puede eliminar de la base de datos (protección de la conservación obligatoria).

- **Descargar mis datos**: en Perfil → Privacidad el paciente descarga un archivo con todo lo que ha registrado (derecho de acceso y portabilidad). En la historia clínica tienes «Exportar datos» para atender una petición de acceso, con la historia incluida; queda en el registro de accesos.
- **Consentimiento 1.2-borrador**: ahora explica la historia clínica (que la guarda la clínica, que el paciente no la ve en la app, su base legal y que se conserva al menos 5 años), el sueño, las comidas, los hábitos y la descarga de datos. Al entrar, el paciente tendrá que aceptarlo de nuevo. Copia para el asesor en `docs/legal/consentimiento.md`.
- La app se actualiza sola al abrirla (desde la 0.13.1).
- Base de datos: migraciones 0016, 0017 y 0018 aplicadas en `vitaltrain-dev`. Doble factor TOTP comprobado como activado en Supabase.
- Cómo probarlo: sube `vitaltrain-app-0.14.0-para-cloudflare.zip`. En la ficha del paciente de prueba: sube un PDF en Documentos y míralo en su Perfil; abre el resumen del mes; pulsa «Historia clínica», configura el doble factor y crea una consulta. **Solo datos inventados**: los pacientes reales irán a `vitaltrain-prod`.

## 2026-11-09 · La app se actualiza sola (versión 0.13.1)
- Hasta ahora, al abrir la app tras subir una versión nueva, el móvil o el navegador seguían enseñando la anterior, guardada en el dispositivo. A Rubén le salía la 0.7.0 con la 0.13.0 ya publicada.
- Ahora, al abrir la app, comprueba si hay versión nueva y, si la hay, se recarga sola en uno o dos segundos.
- Cómo probarlo: sube este zip, abre la app en el móvil y mira abajo del todo: «Versión 0.13.1». La primera vez puede hacer falta cerrarla y abrirla; desde la siguiente versión ya será automático.

## 2026-11-08 · Tareas 16 y 17: ritmos circadianos y hábitos por pilar (versión 0.13.0)
Estos dos módulos se activan **por paciente**. En su ficha hay una sección nueva, **«Qué ve en su app»**, con una casilla por módulo: Entrenamiento, Mensajes, Ritmos circadianos y Hábitos. Quitar uno no borra sus datos.

**Ritmos circadianos**
- En Hoy aparece «Tu luz de hoy»: amanecer, ventana UVB y atardecer, y dos botones: «Anotar sueño» y «Anotar comida».
- «Ver más» abre **Mi ritmo**:
  - **Panel solar** de su ciudad: amanecer, mediodía solar, atardecer, primera y última luz, horas de sol, altura del sol ahora, ventanas UVA (sol por encima de 10°) y UVB (por encima de 30°) y cuántos días quedan con ventana UVB. Se puede pasar de día con las flechas. Para Llíria hoy: amanecer 07:39, mediodía 12:47, atardecer 17:55, UVB 11:16–14:18, 16 días con UVB. Cuadra con MyCircadian (diferencias de 1 minuto).
  - Todo se calcula en el móvil con la ciudad que elige el paciente (63 ciudades de España, Andorra y Lisboa). No usa GPS ni servicios externos.
  - No muestra índice UV ni luxómetro: eso necesita datos meteorológicos o el sensor del móvil. Lo indica como estimación.
  - **Mi sueño**: registro en menos de 20 segundos (noche, hora de acostarse y levantarse, cuánto tardó en dormirse, despertares, calidad, cómo se levantó, si al día siguiente libraba). Gráfica de las últimas 2 semanas.
  - **Mis horarios de comida**: solo la hora y el tipo. Ve su ventana del día y una gráfica de 14 días. Sin calorías.
- En tu ficha: noches anotadas, sueño medio, hora media de acostarse y levantarse, **regularidad** (cuánto varía), **jet lag social** (diferencia del punto medio del sueño entre días libres y laborables), calidad y descanso, **ventana de alimentación** media y tiempo entre la última comida y la cama. Con las dos gráficas y el panel solar de su ciudad. Puedes elegir su ciudad y anotar una noche tú.

**Hábitos por pilar**
- Catálogo inicial de 23 hábitos de los cinco pilares (alimentación, movimiento, ritmos, regulación emocional y naturaleza), cada uno con su instrucción en una línea y su porqué. Puedes crear los tuyos desde el panel.
- En la ficha, «+ Asignar hábito»: eliges del catálogo (filtrado por pilar), pones el objetivo si es de cantidad, qué días toca y una indicación personal.
- El paciente ve en Hoy **«Hábitos de hoy»** agrupados por pilar y los marca de un toque (sí/no, cantidad con + y −, escala 1-5 u hora). Tocando el nombre ve tu indicación y el porqué.
- Los pilares con hábitos asignados se encienden en «Tus pilares».
- **Constancia**: cuadrícula de 14 días por hábito con el % cumplido. La ve el paciente en Progreso y tú en la ficha.
- Seguridad: el paciente no puede asignarse hábitos, cambiar objetivos ni marcar días futuros o de hace más de una semana. Comprobado con pruebas.

- Base de datos: migraciones 0014 y 0015 aplicadas en `vitaltrain-dev`.
- Cómo probarlo: sube el zip `vitaltrain-app-0.13.0-para-cloudflare.zip` a vitaltrain-prueba. En la ficha de tu paciente de prueba marca «Ritmos circadianos» y «Hábitos», asígnale dos o tres hábitos y entra con su cuenta en el móvil.

## 2026-11-08 · Correcciones de la revisión de seguridad (versión 0.12.1)
Un revisor independiente ha repasado toda la base de datos y la app. No ha encontrado forma de que un paciente vea datos de otro ni de saltarse el consentimiento. Sí encontró cuatro fallos que podían perder o falsear datos; están corregidos:
- **Quitar una sesión del calendario podía borrar una nota del paciente** (por ejemplo, «No puedo hacerlo: dolor»). Ahora la base de datos impide borrar cualquier ejercicio con series o notas, se haga desde donde se haga.
- **Si el paciente cambiaba una nota que ya habías leído, no volvía a aparecer como nueva.** Ahora sí. Y «Marcar como leídas» solo marca las que estás viendo.
- **Entrenar sin conexión mientras tú cambiabas esa sesión** podía perder registros sin avisar. Ahora el paciente ve un aviso en Hoy para que te escriba, y «Cambiar un ejercicio» empieza por defecto desde mañana.
- **Entre las 00:00 y las 01:00 no se podían anotar medidas** porque el servidor va en hora UTC. Ahora usa la hora de España.
- Base de datos: migración 0013 aplicada en `vitaltrain-dev`.

## 2026-11-08 · Tarea 14: mensajes (versión 0.12.0)
- El paciente tiene una pestaña nueva, **Mensajes**, para escribirte. Junto al icono aparece un número cuando tiene mensajes tuyos sin leer.
- Tú tienes la sección **Mensajes** en el panel: a la izquierda los pacientes, con los que tienen mensajes sin leer arriba; a la derecha la conversación, con su última sesión hecha y un botón para ver su ficha.
- **Respuestas rápidas**: frases que pones con un toque y puedes retocar antes de enviar.
- Ves si el paciente ha leído tu mensaje («leído» o «enviado»).
- En Inicio, los mensajes sin leer cuentan en «Notas y mensajes sin leer» y en «Necesitan atención».
- La conversación se actualiza sola cada 15 segundos mientras está abierta.
- Todavía no hay aviso en el móvil ni por email cuando llega un mensaje: el paciente lo ve al abrir la app. Llegará con los recordatorios.
- Seguridad: nadie puede editar mensajes ni hacerse pasar por otro; un paciente solo ve su conversación. Comprobado con pruebas.
- Base de datos: migración 0012 aplicada en `vitaltrain-dev`.
- Cómo probarlo: escribe desde el móvil como paciente de prueba y contesta desde el panel.

## 2026-11-08 · Tarea 13: Mis medidas (versión 0.11.0)
- En la pestaña Progreso del paciente, debajo de las gráficas, está **Mis medidas**: peso, cintura y cadera. Opcional y sin fotos.
- «Anotar» abre una ventana con el día y las tres medidas. Se rellena solo lo que se quiera. Si ya anotó ese día, se sustituye.
- Se ve el último valor de cada medida, cuánto ha cambiado desde la primera anotación y una gráfica de la que elijas.
- En tu ficha del paciente aparece lo mismo y también puedes anotar tú, por ejemplo en consulta.
- Base de datos: migración 0011 aplicada en `vitaltrain-dev`.
- Cómo probarlo: como paciente de prueba, Progreso → Mis medidas → Anotar. Luego mira su ficha como coach.

## 2026-11-08 · Tarea 12: panel de inicio (versión 0.10.0)
- Al entrar como coach, la primera pantalla es **Inicio**.
- Arriba: pacientes activos, sesiones hechas esta semana sobre las pautadas, cuántos llevan 7 días o más sin entrenar y notas sin leer.
- **Necesitan atención**: cada paciente con algo pendiente y el motivo (no ha aceptado el consentimiento, días sin entrenar, sesiones de esta semana no hechas, no le queda ninguna sesión pendiente, notas sin leer).
- **La semana de cada paciente**: una fila por paciente con un círculo por día (hecha, hoy, pendiente, no hecha), cuántas lleva y su última sesión.
- **Notas sin leer** de todos los pacientes juntas.
- Tocando cualquier paciente se abre su ficha.
- No cambia la base de datos.
- Cómo probarlo: entra como coach. Debe salir Inicio con tu paciente de prueba.

## 2026-11-08 · Tarea 11: Mi progreso (versión 0.9.0)
- El paciente tiene una pestaña nueva, **Progreso**, en el menú de abajo.
- Arriba, tres datos: sesiones hechas esta semana, porcentaje hecho en las últimas 4 semanas y esfuerzo medio del último mes.
- **Entrenamientos por semana** (12 semanas): la barra gris son las sesiones pautadas y la oscura las hechas.
- **Esfuerzo medio por semana**, de 1 a 10.
- **Carga por ejercicio**: eliges un ejercicio y ves la serie más pesada de cada día, con el último valor, el máximo y cuánto ha subido desde el principio.
- Tocando una barra o un punto se ve el dato exacto.
- En tu ficha del paciente aparece lo mismo en la sección **Progresión**.
- No cambia la base de datos: usa lo que el paciente ya registra.
- Cómo probarlo: entra como tu paciente de prueba, abre Progreso. Con la sesión que hiciste deberías ver una barra esta semana y, si anotaste kilos, el ejercicio en «Carga por ejercicio».

## 2026-11-08 · Tarea 10: cambiar un ejercicio en todo el plan (versión 0.8.0)
- En la ficha del paciente, junto a «Copiar semana anterior», está **«Cambiar un ejercicio»**.
- Muestra los ejercicios que tiene en sus sesiones pendientes y en cuántas aparece. Eliges el que quieres quitar y el que lo sustituye.
- Se mantienen series, repeticiones y descanso. La carga puedes mantenerla, quitarla o poner una nueva; la indicación para el paciente también se puede cambiar.
- Antes de confirmar te dice en qué sesiones y fechas se cambiará.
- Nunca toca sesiones hechas ni ejercicios en los que el paciente ya haya registrado series o notas.
- Base de datos: migración 0010 aplicada en `vitaltrain-dev`.
- Cómo probarlo: con tu paciente de prueba, pulsa «Cambiar un ejercicio», elige uno de sus ejercicios, cámbialo por otro con una carga nueva y abre una de sus sesiones pendientes para comprobarlo.

## 2026-11-08 · Consentimiento 1.1-borrador (versión 0.7.2)
- Completados los datos del responsable: Rubén Úbeda Rubio, titular de Clínica Vitaltrain, Calle Sorní 40, 2, 46004 Valencia, contacto info@vitaltrain.com.
- Quitadas las líneas de delegado de protección de datos y de menores, que no aplican.
- Solo queda por fijar el plazo de conservación tras la baja.
- Como el texto ha cambiado, el paciente de prueba verá «Hemos actualizado cómo tratamos tus datos» y tendrá que aceptarlo de nuevo. Es lo esperado.

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
