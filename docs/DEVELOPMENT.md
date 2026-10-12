# Construir y probar sin esperar días

El juego mantiene tiempo real para jugadores. El laboratorio permite al desarrollador simular hoy todas las etapas con otra mascota, persistida por separado. No se cambia la fecha del teléfono ni la edad de la mascota normal.

## Activar en el servicio Render que ya tienes

1. Abre el Blueprint de PetVerse, conectado a `feat/free-render-trial`.
2. Pulsa **Manual sync** para aplicar el último código y la variable `PETVERSE_DEVELOPER_TOOLS=true` incluida en `render.yaml`. No hace falta crear otro servidor o base.
3. Espera a que `petverse-prueba` vuelva a **Live**, abre tu URL habitual y recarga.
4. En el juego, **Ajustes (engranaje) → Abrir laboratorio de desarrollo**.

Si actualizas únicamente con **Manual Deploy**, también debes añadir la variable `PETVERSE_DEVELOPER_TOOLS=true` en Environment y volver a desplegar; el Blueprint evita ese paso manual. Los recursos siguen Free y no se añade un disco. La prueba conserva el límite de la base Free de 30 días.

## Controles

| Control | Qué prueba |
| --- | --- |
| +1 minuto | Repetir cuidados superando su cooldown |
| +6 horas | Nueva ventana de posibles sorpresas |
| +1 día | Estado después de un día simulado |
| +7 días | Ausencia larga y crecimiento |
| Siguiente etapa | Salto exacto a días 1, 4, 11, 26, 51 y 101 |
| Reiniciar mascota de prueba | Otro experimento desde el nacimiento |
| Volver a mi mascota | Partida normal con su edad real |

El laboratorio reutiliza nombre, personalidad y color de tu mascota si existe, con un identificador nuevo, cuidados a cero e historial propio. También puedes abrirlo antes de adoptar. Las sorpresas no se fuerzan: mantienen condiciones y probabilidades. No se concede inventario real ni se registran métricas de uso de juego por probar. El reloj simulado queda fijo hasta pulsar un salto; recargar, cerrar o reiniciar servidor no lo adelanta.

La vista se recuerda en este navegador. Entrar otra vez reanuda el experimento, salvo que lo reinicies. Las tarjetas compartibles llevan «LABORATORIO · TIEMPO SIMULADO». El máximo de simulación es diez años; en la última etapa puedes seguir probando días y cuidados o reiniciar.

## Local

```bash
npm ci
PETVERSE_DEVELOPER_TOOLS=true npm start
```

La variable está apagada por defecto. La plantilla Free la habilita por ser un entorno de validación; un servidor para jugadores puede dejarla apagada. En ese caso no hay botón y los endpoints de laboratorio devuelven 404. Ninguna persona obtiene permisos para alterar la mascota real mediante el laboratorio.

## Implementación

`server/lab.mjs` controla la simulación usando las mismas reglas de dominio. `sandboxes` guarda el estado por propietario, fuera de `pets`/`events`. Reutiliza cookies, CSRF, bloqueos y claves idempotentes. Solo acepta saltos enumerados por servidor; no fechas, edades ni identificadores enviados por el cliente. Las sesiones siguen caducando por reloj real, nunca por edad simulada. Añadir la tabla no borra ni migra mascotas existentes.

API: `GET /api/lab/state`; `POST /api/lab/start`, `/reset`, `/advance` (cuerpo `{step}`), `/actions` (cuerpo `{action}`). No se implementan rutas de adelanto en `/api/actions` o `/api/adopt`.

## Trabajar desde el teléfono

Puedes pedir a Codex una funcionalidad concreta en lenguaje natural, por ejemplo «Añade una sorpresa relacionada con la personalidad dormilona» o «Haz que las orejas cambien al llegar a juvenil». Codex revisa e implementa el cambio, ejecuta tests, actualiza documentos y sube la rama/PR. Actualiza el servicio existente y usa el laboratorio para comprobarlo ese mismo día. Un nuevo cambio de código no implica contratar otro servicio.

## Verificación

`npm run check` y `npm test`. Con `PETVERSE_TEST_DATABASE_URL` se ejecutan también contratos sobre PostgreSQL real. `npm run test:browser` verifica entrada, seis transiciones, conservación de la partida normal, recarga, reinicio, reseteo y salida desde móvil. Las capturas se generan con usuarios ficticios. No se afirma haber actualizado Render sin comprobarlo.
