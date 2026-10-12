# Decisiones — 2026-10-12

## PWA y 2D primero

Validación móvil rápida sin tiendas. SVG original provisional, sin recursos externos, con colores, expresión y reacciones. Posponer app nativa, 3D y arte final hasta validar el vínculo. Dominio independiente para facilitar sustitución.

## Servidor autoritativo y SQLite

Edad y persistencia en servidor. Node 24 aporta SQLite para ejecución local con disco duradero. El adaptador PostgreSQL permite probar sin disco de pago y prepara la persistencia para varios procesos; aún faltan límites distribuidos, observabilidad y carga. No se promete escala internacional ya verificada.

## Sesiones de prueba

El documento maestro admite cuenta o sesión de prueba en el MVP. Se implementa cookie aleatoria sin email/contraseña, con límite visible de 30 días y sin traslado de dispositivo. No sustituye acceso permanente; cuentas y recuperación son prioridad antes de beta amplia.

## Reconciliar al volver

Timestamps persistidos y reloj de host sincronizado; no cron por mascota. Transacciones e idempotencia protegen de reintentos y concurrencia. Tiradas deterministas por ventana impiden fabricar sorpresas recargando. Ausencia sin penalización fuerte ni recompensas acumuladas.

## Privacidad mínima

Métricas desactivadas inicialmente, consentimiento y borrado al revocar; sin terceros ni nombres. UUID de sesión es seudónimo. Compartir lo inicia el jugador. No se inventan indicadores comerciales o de retención.

## Entrega mediante PR

Rama de trabajo, documentos y PR; conservar archivo previo. Blueprint de Render opcional con disco persistente, configuración y posibles costes documentados. No contratar ni desplegar hosting desde esta tarea centrada en guardar/revisar el código en GitHub.

## Prueba desde el teléfono — publicación preparada

El servidor usa la URL HTTPS de Render, sin aceptar un origen enviado por el cliente. El enlace apunta a la rama jugable sin merge obligatorio y mantiene despliegues manuales. Inicialmente se preparó SQLite con un plan/disco de pago; esa opción ya no es el despliegue predeterminado y queda en `render-persistent.yaml`. No se contrató ni publicó un servicio desde esta sesión sin conexión de Render.

## Prueba sin servidor ni disco de pago

Tras la objeción del propietario al coste, `render.yaml` pasa a servidor Free y PostgreSQL Free, sin disco. Se añade un adaptador `pg` y llamadas de almacenamiento asíncronas conservando SQLite y las reglas existentes. PostgreSQL hace persistir mascota, cookie e idempotencia entre reinicios del servidor Free. Bloqueos por propietario impiden pérdidas concurrentes; transacciones evitan recompensas duplicadas. La prueba no promete alojamiento perpetuo: la base Free vence 30 días después de crearla y el servidor tiene arranque en frío; se muestran límites en el juego y README. No se migra ni elimina la mascota de un servicio anterior automáticamente. Los cambios tampoco cancelan recursos/facturación previamente creados por el propietario.

La corrección se publica en `feat/free-render-trial`, con un enlace de despliegue nuevo. No se modifica la rama del enlace anterior: así una posible instancia de Blueprint ya creada no recibe cambios de infraestructura automáticamente. El nuevo PR sustituye la propuesta inicial de pago como entrega recomendada.
