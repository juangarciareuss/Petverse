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
- Laboratorio de desarrollo con mascota/historial propios, reloj congelado, saltos de minuto/horas/días/siguiente etapa, reinicio y regreso a la partida normal. Habilitado explícitamente en la plantilla Free, apagado por defecto en otros entornos.

## Verificación

- `npm run check`: sintaxis verificada.
- `npm test` con SQLite: 21 pruebas aprobadas y dos específicas de PostgreSQL omitidas explícitamente.
- `PETVERSE_TEST_DATABASE_URL=... npm test` contra PostgreSQL 17 local real: 23 pruebas aprobadas sin omisiones. Incluye laboratorio hasta día 101, aislamiento, idempotencia de saltos/reseteos, permisos, límites de tiempo, migración SQLite v1, rollback y concurrencia.
- QA Chromium móvil/escritorio usando SQLite y PostgreSQL reales: aprobada. Adopción, cuidados, PNG, laboratorio hasta día 101, conservación de mascota real, reanudación, reinicio del servidor, reset, salida, offline, 320 px y movimiento reducido. Tarjetas simuladas con marca de laboratorio.
- Docker construido con dependencias `npm ci`; arranque real sin root usando PostgreSQL, origen HTTPS automático, cookie Secure, aviso Free, health, adopción y tres cuidados comprobados. La imagen del laboratorio también se probó hasta el día 101, conservando la mascota normal en día 0. No equivale a despliegue en Render.
- Capturas de una sesión ficticia de QA: [móvil](images/mvp-mobile.png) y [escritorio](images/mvp-desktop.png). No contienen usuarios reales.
- [Laboratorio móvil](images/laboratorio-mobile.png): captura ficticia con día simulado 101.

La primera batería detectó una normalización incorrecta de la ruta de estáticos; se corrigió y las pruebas HTTP pasaron. La prueba offline se ajustó para esperar la reconexión automática en vez de pulsar un botón ya oculto. No se presenta esta QA como prueba en iPhone físico ni despliegue en Render.

## Límites

Sin cuentas permanentes, recuperación entre dispositivos, pagos, oportunidades recuperables, decoración, aseo, entrenamiento, especies nuevas ni vídeos. Arte provisional. El propietario informa que activó Render y que el enlace del juego funciona; no ha compartido su URL y Codex no lo ha verificado directamente. La actualización del laboratorio requiere sincronizar el Blueprint existente y confirmar la interfaz nueva. La base Free vence a los 30 días y el servidor duerme; no se promete alojamiento permanente ni ausencia de excesos de cuota con tarjeta añadida.

SQLite admite una instancia; backups se operan externamente. No se ha verificado escala masiva, Safari/iOS real, retención ni auditoría de seguridad comercial. Producción exige HTTPS y hora sincronizada. `prueba.txt` se conserva.

## Activación de la sesión de prueba

El propietario activó la plantilla Free y después confirmó que el enlace funciona. No se creó, contrató, canceló ni eliminó ningún servicio desde esta sesión; no hay conexión de Render ni acceso a su facturación. Para continuar hoy, actualizar ese mismo Blueprint con **Manual sync** y entrar en **Ajustes → Abrir laboratorio de desarrollo**. El paso aplica también `PETVERSE_DEVELOPER_TOOLS=true`; actualizar solo código sin esta variable deja el laboratorio desactivado. Guía: [DEVELOPMENT](DEVELOPMENT.md).
