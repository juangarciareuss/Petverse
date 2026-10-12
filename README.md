# PetVerse

Una mascota virtual que crece contigo, a su ritmo. MVP móvil: adopta un Lumis, dale nombre, aliméntalo, acarícialo y juega. Personalidad, cuidados, edad y recuerdos se guardan en servidor.

Capturas de QA: [vista móvil](docs/images/mvp-mobile.png) · [vista de escritorio](docs/images/mvp-desktop.png).

## Ejecutar

Requisito: **Node.js 24 LTS**. Sin dependencias de npm ni compilación.

```bash
git clone https://github.com/juangarciareuss/Petverse.git
cd Petverse
git checkout feat/playable-petverse-mvp
npm start
```

Abre `http://localhost:3000`. Adopta, realiza los tres cuidados, recarga y comprueba persistencia. El mismo cuidado espera 15 segundos antes de repetirse. Etapas por días reales; no hace falta mantener abierta la aplicación. Sorpresas por ventanas de seis horas, no garantizadas en cada visita.

SQLite se crea en `data/petverse.sqlite`: no borres el directorio ni uses disco efímero. La sesión de prueba depende de la cookie de este navegador y caduca en 30 días, sin recuperación o traslado a otro dispositivo todavía.

## Probar desde un celular

- En la misma Wi-Fi que tu ordenador: abre `http://IP-LOCAL-DEL-ORDENADOR:3000`, con el cortafuegos permitiendo el puerto. El servidor escucha en `0.0.0.0`. Permite jugar; instalar PWA y compartir con APIs nativas requieren HTTPS. La IP de este entorno remoto no es accesible desde el teléfono.
- Desde cualquier lugar: despliega con HTTPS y disco persistente según las instrucciones siguientes. Abre la URL pública en Safari/Chrome y usa el mismo navegador para recuperar tu sesión.
- iPhone: Compartir → Añadir a pantalla de inicio. Android: menú → Instalar aplicación, cuando esté disponible. Offline se muestra el shell; los cuidados y el estado requieren red.

## Despliegue opcional en Render

`render.yaml` configura un Blueprint Docker con disco `/data` y health check `/health`. No se ha contratado ni desplegado. El plan con disco puede tener coste; revisa precios antes de crear recursos.

1. Revisa/mergea el PR o selecciona esta rama al conectar el repositorio en Render. Usa el Blueprint o crea un Web Service Docker manual.
2. Mantén una sola instancia y disco persistente en `/data`; Docker usa `DATABASE_PATH=/data/petverse.sqlite`.
3. Configura `PUBLIC_ORIGIN` como la URL HTTPS real del servicio, sin barra final. Ejemplo: `https://petverse-TU-SERVICIO.onrender.com`; sustituye por tu dirección, no copies literalmente. Producción necesita esta variable para arrancar.
4. Despliega y verifica `/health` → `{"ok":true}`. Adopta desde el celular, cuida, recarga y reinicia el servicio: debe conservar mascota e historial.
5. Prepara copias SQLite consistentes y prueba una restauración antes de invitar usuarios.

Alternativa: Docker con proxy HTTPS, volumen persistente y `PUBLIC_ORIGIN`. GitHub Pages no ejecuta este backend. No hay pagos ni proveedor de cuentas.

## Variables

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz |
| `DATABASE_PATH` | `data/petverse.sqlite` | Archivo persistente |
| `NODE_ENV` | desarrollo | `production` activa Secure y exige HTTPS |
| `PUBLIC_ORIGIN` | origen HTTP local | URL exacta de producción |

`.env.example` documenta variables; no se carga automáticamente. Usa variables del hosting o `node --env-file=.env server/index.mjs` con tu archivo local. No subir secretos ni SQLite.

## Verificación

```bash
npm run check
npm test
```

Pruebas de edad, personalidad, inactividad, reloj que retrocede, sorpresa reproducible, objeto único, aislamiento, CSRF, fechas manipuladas, persistencia e idempotencia concurrente. Relojes controlados solo en tests, sin trucos de evolución habilitados en producción.

QA de navegador opcional: `npm run test:browser` requiere Playwright y Chromium disponibles. En un entorno de desarrollo puedes preparar las herramientas con `npm install --no-save --package-lock=false playwright` y `npx playwright install chromium`. Si usas un Chromium de sistema, configura `CHROMIUM_PATH` con su ruta. Las herramientas de QA no son dependencias de producción; el script guarda capturas en `test-results/`, excluido de Git.

`npm run metrics` muestra solo cuidados reales consentidos y no calcula retención. Se desactivan y borran en Ajustes.

## Documentación

[Visión](docs/VISION.md), [arquitectura](docs/ARCHITECTURE.md), [diseño de juego](docs/GAME_DESIGN.md), [decisiones](docs/DECISIONS.md), [roadmap](docs/ROADMAP.md), [progreso](docs/PROGRESS.md).

Próxima prioridad: hosting persistente, cuentas permanentes y validación del vínculo con usuarios antes de monetizar.
