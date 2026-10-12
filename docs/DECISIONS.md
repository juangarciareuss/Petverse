# Decisiones — 2026-10-12

## PWA y 2D primero

Validación móvil rápida sin tiendas. SVG original provisional, sin recursos externos, con colores, expresión y reacciones. Posponer app nativa, 3D y arte final hasta validar el vínculo. Dominio independiente para facilitar sustitución.

## Servidor autoritativo y SQLite

Edad y persistencia en servidor. Node 24 aporta SQLite sin dependencias; basta un proceso con disco duradero en esta iteración. PostgreSQL será necesario para múltiples instancias. No se promete escala internacional ya verificada.

## Sesiones de prueba

El documento maestro admite cuenta o sesión de prueba en el MVP. Se implementa cookie aleatoria sin email/contraseña, con límite visible de 30 días y sin traslado de dispositivo. No sustituye acceso permanente; cuentas y recuperación son prioridad antes de beta amplia.

## Reconciliar al volver

Timestamps persistidos y reloj de host sincronizado; no cron por mascota. Transacciones e idempotencia protegen de reintentos y concurrencia. Tiradas deterministas por ventana impiden fabricar sorpresas recargando. Ausencia sin penalización fuerte ni recompensas acumuladas.

## Privacidad mínima

Métricas desactivadas inicialmente, consentimiento y borrado al revocar; sin terceros ni nombres. UUID de sesión es seudónimo. Compartir lo inicia el jugador. No se inventan indicadores comerciales o de retención.

## Entrega mediante PR

Rama de trabajo, documentos y PR; conservar archivo previo. Blueprint de Render opcional con disco persistente, configuración y posibles costes documentados. No contratar ni desplegar hosting desde esta tarea centrada en guardar/revisar el código en GitHub.

## Prueba desde el teléfono — publicación preparada

El propietario pidió jugar y confirmó que todavía no tiene servicio en Render. Se preparó un enlace oficial de Deploy to Render apuntando a la rama jugable. El servidor usa la URL HTTPS que Render proporciona, sin aceptar un origen enviado por el cliente. El Blueprint emplea el identificador actual `0.5c-512mb`, disco duradero y despliegues automáticos desactivados. El propietario revisa y aprueba recursos/coste en Render; no se contrató ni publicó ningún servicio desde esta sesión, que no dispone de conexión de Render. No sustituir el servidor por una demo local que afirme conservar datos online.
