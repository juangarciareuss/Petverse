# Continuidad para Codex

- Comunica avances en español. El propietario dirige producto desde lenguaje natural.
- Lee README y `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/GAME_DESIGN.md` antes de cambiar reglas.
- Examina código y estado Git antes de editar. Conserva funcionalidades y datos. Trabaja en ramas y prepara PR.
- Node.js 24 LTS. Servidor autoritativo: no calcular edad, etapas o recompensas con reloj/estado enviado por cliente.
- Cuidados, eventos e idempotencia deben permanecer transaccionales y aislados por usuario.
- No vender edad/evolución ni añadir pagos antes de validar el juego. No castigar ausencia ni publicar recuerdos automáticamente.
- No versionar SQLite, cookies, secretos, métricas de usuarios ni capturas de sesiones reales.
- Verifica con `npm run check` y `npm test`. Para cambios de interacción, usa `npm run test:browser` si Playwright/Chromium están disponibles; informa limitaciones.
- Actualiza progreso real y decisiones. No afirmar despliegue, resultados de retención o pruebas que no se hicieron.
- Para activar una prueba, el Blueprint predeterminado usa Free + PostgreSQL Free (30 días), sin disco de pago. No volver a convertir el enlace de prueba en uno de pago sin una decisión explícita del propietario. La opción de pago está separada en `render-persistent.yaml`.
- Próxima prioridad: hosting duradero, cuenta permanente y validación con usuarios. Render es opcional, no está desplegado por este PR.
