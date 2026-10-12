# PetVerse

Una mascota virtual que crece contigo, a su ritmo. MVP móvil: adopta un Lumis, dale nombre, aliméntalo, acarícialo y juega. Personalidad, cuidados, edad y recuerdos se guardan en servidor.

Capturas de QA: [vista móvil](docs/images/mvp-mobile.png) · [vista de escritorio](docs/images/mvp-desktop.png).

## Ejecutar

Requisito: **Node.js 24 LTS**. Sin compilación; `pg` aporta PostgreSQL cuando se usa la prueba gratuita de Render. En local se conserva SQLite.

```bash
git clone https://github.com/juangarciareuss/Petverse.git
cd Petverse
git checkout feat/free-render-trial
npm ci
npm start
```

Abre `http://localhost:3000`. Adopta, realiza los tres cuidados, recarga y comprueba persistencia. El mismo cuidado espera 15 segundos antes de repetirse. Etapas por días reales; no hace falta mantener abierta la aplicación. Sorpresas por ventanas de seis horas, no garantizadas en cada visita.

Sin `DATABASE_URL`, SQLite se crea en `data/petverse.sqlite`: no borres el directorio ni uses disco efímero. Con `DATABASE_URL`, el estado se guarda en PostgreSQL y sobrevive a los reinicios del servidor. Los datos existentes de SQLite no se migran automáticamente. La sesión de prueba depende de la cookie de este navegador y caduca en 30 días, sin recuperación o traslado a otro dispositivo todavía.

## Probar desde un celular

- En la misma Wi-Fi que tu ordenador: abre `http://IP-LOCAL-DEL-ORDENADOR:3000`, con el cortafuegos permitiendo el puerto. El servidor escucha en `0.0.0.0`. Permite jugar; instalar PWA y compartir con APIs nativas requieren HTTPS. La IP de este entorno remoto no es accesible desde el teléfono.
- Desde cualquier lugar: activa la prueba gratuita con HTTPS y PostgreSQL según las instrucciones siguientes. Abre la URL pública en Safari/Chrome y usa el mismo navegador para recuperar tu sesión.
- iPhone: Compartir → Añadir a pantalla de inicio. Android: menú → Instalar aplicación, cuando esté disponible. Offline se muestra el shell; los cuidados y el estado requieren red.

## Prueba gratuita en Render — 30 días

`render.yaml` ahora configura **un servidor Free y una base PostgreSQL Free, sin disco de pago**. La alternativa anterior con disco se conserva separada en `render-persistent.yaml`, exclusivamente para quien decida contratarla. No se ha publicado ni contratado ningún servicio desde esta sesión.

[**Activar la prueba gratuita de PetVerse**](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fjuangarciareuss%2FPetverse%2Ftree%2Ffeat%2Ffree-render-trial)

El enlace usa la nueva rama `feat/free-render-trial`; no es necesario mergear el PR. Antes de crear, la pantalla debe mostrar **`petverse-prueba`: Free** y **`petverse-prueba-db`: Free**, sin disco. Si tienes abierta la pantalla del enlace anterior de pago, ciérrala y abre este enlace nuevo para cargar la configuración gratuita.

1. Inicia sesión en Render y revisa esos dos recursos Free. Su nivel gratuito no requiere tarjeta. No elijas un plan de pago ni la plantilla alternativa con disco para esta prueba.
2. Crea/despliega la instancia del Blueprint. `DATABASE_URL` se conecta automáticamente a PostgreSQL; la URL HTTPS se detecta con `RENDER_EXTERNAL_URL`, sin campos manuales de secretos.
3. Espera a que `petverse-prueba` aparezca `Live` y abre su URL `.onrender.com` desde Safari/Chrome. Adopta y cuida; recargar o reiniciar el servidor no borra la mascota mientras exista la base.
4. `/health` debe devolver `{"ok":true}`. Guarda/exporta los datos antes del vencimiento de la base si deseas conservar la prueba más tiempo.

**Límites reales:** la base Free caduca 30 días después de crearla; no es alojamiento permanente. El servidor Free duerme después de inactividad y puede tardar en despertar. Render solo permite una base Free por cuenta/workspace. La interfaz muestra este aviso. No se activa una actualización de pago automáticamente desde el juego.

El uso gratuito tiene cuotas de ancho de banda y compilación; con un método de pago añadido Render puede facturar excesos. Este proyecto no añade tarjetas, contrata planes ni cancela servicios de pago existentes. Si ya creaste el servicio anterior, revisa su facturación por separado y conserva/exporta cualquier mascota antes de eliminar sus datos. Crear la nueva prueba gratuita no cancela aquel servicio.

Las actualizaciones quedan en modo manual. Referencias oficiales: [despliegue por rama](https://render.com/docs/deploy-to-render), [URL automática](https://render.com/docs/environment-variables), [límites Free](https://render.com/docs/free), [facturación incluso con Free](https://render.com/docs/faq).

## Alojamiento permanente — opcional y separado

`render-persistent.yaml` mantiene la opción SQLite con un servidor y disco de pago, sin aplicarla al botón de prueba. También puedes alojar Docker con HTTPS y volumen duradero, o PostgreSQL propio, usando `PUBLIC_ORIGIN`. GitHub Pages no ejecuta este backend. No se migran datos ni se eliminan servicios existentes automáticamente.

## Variables

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz |
| `DATABASE_PATH` | `data/petverse.sqlite` | Archivo persistente |
| `DATABASE_URL` | sin definir | PostgreSQL si existe; tiene prioridad sobre SQLite |
| `PETVERSE_TRIAL_MODE` | sin definir | `render-free` muestra límites de la prueba |
| `NODE_ENV` | desarrollo | `production` activa Secure y exige HTTPS |
| `PUBLIC_ORIGIN` | `RENDER_EXTERNAL_URL` en Render, o HTTP local | URL exacta de producción; fijar para dominio propio |

`.env.example` documenta variables; no se carga automáticamente. Usa variables del hosting o `node --env-file=.env server/index.mjs` con tu archivo local. No subir secretos ni SQLite.

## Verificación

```bash
npm run check
npm test
```

Pruebas de edad, personalidad, inactividad, reloj que retrocede, sorpresa reproducible, objeto único, aislamiento, CSRF, fechas manipuladas, persistencia e idempotencia concurrente. Relojes controlados solo en tests, sin trucos de evolución habilitados en producción.

QA de navegador opcional: `npm run test:browser` requiere Playwright y Chromium disponibles. En un entorno de desarrollo puedes preparar las herramientas con `npm install --no-save --package-lock=false playwright` y `npx playwright install chromium`. Si usas un Chromium de sistema, configura `CHROMIUM_PATH` con su ruta. Las herramientas de QA no son dependencias de producción; el script guarda capturas en `test-results/`, excluido de Git.

Para verificar PostgreSQL real, configura `PETVERSE_TEST_DATABASE_URL` apuntando a una base **de pruebas** y ejecuta `npm test`; la batería usa esquemas aislados `petverse_test_*` y los limpia al acabar. `npm run test:browser` usa también ese backend si está configurado. Sin esa variable, las dos pruebas específicas de PostgreSQL se omiten explícitamente; las de SQLite y dominio siguen ejecutándose.

`npm run metrics` muestra solo cuidados reales consentidos y no calcula retención. Se desactivan y borran en Ajustes.

## Documentación

[Visión](docs/VISION.md), [arquitectura](docs/ARCHITECTURE.md), [diseño de juego](docs/GAME_DESIGN.md), [decisiones](docs/DECISIONS.md), [roadmap](docs/ROADMAP.md), [progreso](docs/PROGRESS.md).

Próxima prioridad: hosting persistente, cuentas permanentes y validación del vínculo con usuarios antes de monetizar.
