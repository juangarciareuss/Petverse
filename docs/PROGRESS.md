# Progreso real

Fecha: 2026-10-12. Rama: `feat/free-render-trial`.

## Implementado

- PWA en español, Lumis SVG provisional, cuatro personalidades y tres colores.
- Sesión de prueba por cookie HttpOnly (30 días), adopción y nombre persistentes.
- Tres cuidados con efectos, reacciones, mensajes y cooldown.
- SQLite y PostgreSQL transaccionales, historial y objeto descubierto único.
- Edad de servidor, siete umbrales y rasgo expresivo al día 101.
- Sorpresas deterministas cada ventana de seis horas.
- Idempotencia, aislamiento de sesiones, origen, CSRF y campos restringidos.
- Tarjeta PNG para Web Share/descarga, métricas opcionales revocables.
- Shell PWA offline sin simular escrituras; Docker y Blueprint Render Free + PostgreSQL Free, sin disco de pago.
- Enlace Deploy to Render para la nueva rama gratuita, origen HTTPS automático y despliegues manuales. La opción anterior de pago queda separada.

## Verificación

- `npm run check`: sintaxis verificada.
- `npm test` con SQLite: 15 pruebas aprobadas y dos pruebas específicas de PostgreSQL omitidas explícitamente.
- `PETVERSE_TEST_DATABASE_URL=... npm test` contra PostgreSQL 17 local real: 17 pruebas aprobadas sin omisiones. Incluye rollback, conservación de cookie/mascota, dos conexiones de servidor y revocación de métricas con una petición ya iniciada.
- QA Chromium móvil/escritorio usando PostgreSQL real: aprobada. Viewport 390×844, mínimo 320 px y escritorio 1280×900; aviso de límites Free, adopción, tres cuidados, recarga, reloj alterado, privacidad, PNG, reinicio real conservando cookie, offline/reconexión y movimiento reducido.
- Docker actualizado construido con dependencias `npm ci`; arranque real sin root usando PostgreSQL, origen HTTPS automático, cookie Secure, aviso Free, health, adopción y tres cuidados comprobados. No equivale a despliegue en Render.
- Capturas de una sesión ficticia de QA: [móvil](images/mvp-mobile.png) y [escritorio](images/mvp-desktop.png). No contienen usuarios reales.

La primera batería detectó una normalización incorrecta de la ruta de estáticos; se corrigió y las pruebas HTTP pasaron. La prueba offline se ajustó para esperar la reconexión automática en vez de pulsar un botón ya oculto. No se presenta esta QA como prueba en iPhone físico ni despliegue en Render.

## Límites

Sin cuentas permanentes, recuperación entre dispositivos, pagos, oportunidades recuperables, decoración, aseo, entrenamiento, especies nuevas ni vídeos. Arte provisional. No desplegado: aún no hay URL pública jugable. GitHub muestra código y no ejecuta el backend. La base PostgreSQL Free de Render vence a los 30 días; el servidor Free duerme por inactividad. No se promete alojamiento permanente ni ausencia de posibles excesos de cuota con tarjeta añadida.

SQLite admite una instancia; backups se operan externamente. No se ha verificado escala masiva, Safari/iOS real, retención ni auditoría de seguridad comercial. Producción exige HTTPS y hora sincronizada. `prueba.txt` se conserva.

## Activación de la sesión de prueba

El propietario confirmó inicialmente que no tenía un servicio y después objetó el coste mostrado por la plantilla con disco. Ahora el README enlaza la rama gratuita con dos recursos Free y sin disco. Falta iniciar sesión y crear esa nueva prueba en Render para obtener una URL. No se creó, contrató, canceló ni eliminó ningún servicio desde esta sesión; no hay conexión de Render. Si ya existe un servicio de pago del enlace anterior, esta corrección no cancela sus cargos ni migra su mascota. Los helpers locales requeridos por Sites no están instalados; no se creó un Site incompleto. El estado de facturación del propietario no puede verificarse desde aquí.
