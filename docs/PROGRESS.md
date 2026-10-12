# Progreso real

Fecha: 2026-10-12. Rama: `feat/playable-petverse-mvp`.

## Implementado

- PWA en español, Lumis SVG provisional, cuatro personalidades y tres colores.
- Sesión de prueba por cookie HttpOnly (30 días), adopción y nombre persistentes.
- Tres cuidados con efectos, reacciones, mensajes y cooldown.
- SQLite transaccional, historial y objeto descubierto único.
- Edad de servidor, siete umbrales y rasgo expresivo al día 101.
- Sorpresas deterministas cada ventana de seis horas.
- Idempotencia, aislamiento de sesiones, origen, CSRF y campos restringidos.
- Tarjeta PNG para Web Share/descarga, métricas opcionales revocables.
- Shell PWA offline sin simular escrituras; Docker y Blueprint Render.

## Verificación

- `npm run check`: sintaxis verificada.
- `npm test`: 14 pruebas aprobadas (dominio y HTTP con SQLite real).
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: aprobada. Chromium con viewport móvil 390×844, ancho mínimo 320 px y escritorio 1280×900. Adopción, cuidados, recarga, reloj del cliente alterado, consentimiento, tarjeta PNG, reinicio real de backend conservando cookie, offline/reconexión y movimiento reducido.
- Docker: imagen construida con Node 24; ejecución como usuario no root, SQLite escribible, estáticos e iconos disponibles, health y adopción con cookie Secure comprobados. Producción exige origen HTTPS configurado.
- Capturas de una sesión ficticia de QA: [móvil](images/mvp-mobile.png) y [escritorio](images/mvp-desktop.png). No contienen usuarios reales.

La primera batería detectó una normalización incorrecta de la ruta de estáticos; se corrigió y las pruebas HTTP pasaron. La prueba offline se ajustó para esperar la reconexión automática en vez de pulsar un botón ya oculto. No se presenta esta QA como prueba en iPhone físico ni despliegue en Render.

## Límites

Sin cuentas permanentes, recuperación entre dispositivos, pagos, oportunidades recuperables, decoración, aseo, entrenamiento, especies nuevas ni vídeos. Arte provisional. No desplegado: aún no hay URL pública jugable. GitHub muestra código y no ejecuta el backend. Render requiere disco duradero y puede tener coste.

SQLite admite una instancia; backups se operan externamente. No se ha verificado escala masiva, Safari/iOS real, retención ni auditoría de seguridad comercial. Producción exige HTTPS y hora sincronizada. `prueba.txt` se conserva.
