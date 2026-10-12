# Diseño de juego — reglas implementadas

## Ciclo

Sesión de prueba → nombrar y adoptar Lumis → observar → alimentar, acariciar o jugar → reacción, estadísticas e historial → regresar para descubrir crecimiento o sorpresas. Guardado automático. Tarjeta PNG compartible voluntaria mediante Web Share o descarga.

## Mascota

UUID, nombre Unicode 1–24 caracteres, especie, nacimiento, edad calculada, etapa, personalidad, expresión, hambre, energía, alegría, bienestar, confianza, apariencia, rasgos especiales, objetos y actividades. Cuatro personalidades y tres colores derivados del UUID. La personalidad se descubre, no se elige.

## Etapas iniciales revisables

| Etapa | Edad real |
| --- | --- |
| Recién nacido | 0 días |
| Bebé | 1 día |
| Infantil | 4 días |
| Juvenil | 11 días |
| Adolescente | 26 días |
| Adulto | 51 días |
| Evolución especial | 101 días |

Muchos cuidados no adelantan etapas. Tras una ausencia se llega a la etapa correspondiente con un evento, sin todas las notificaciones omitidas. Hay variaciones de tamaño y una marca visual especial; no son siete personajes finales.

## Cuidados y personalidad

Estadísticas 0–100; interfaz muestra saciedad (`100 - hambre`).

| Cuidado | Efectos |
| --- | --- |
| Alimentar | Hambre −30, energía +5, alegría +8, bienestar +1 |
| Acariciar | Confianza +2 (cariñosa +3), alegría +8, bienestar +1 |
| Jugar | Energía −8 (dormilona −12), hambre +4, alegría +8 (juguetona +15), bienestar +1 |

Cada cuidado del mismo tipo espera 15 segundos para repetirse. Con energía <15 no se juega, pero hay caricias y alimento. Energía recupera +2/hora, o +3 para dormilonas. Hambre sube +2/hora hasta 85; alegría baja −0,4/hora hasta 55. Ausencia no reduce confianza/bienestar, ni provoca muerte o enfermedad.

## Sorpresas

Una tirada por ventana de seis horas: 45%, o 70% para curiosas. Saludo, siesta, gesto inventado o piedrita de luna. Personalidad pondera opciones; la piedra solo se encuentra una vez y no da ventaja. Tirada determinista por mascota/ventana, no se repite al recargar y no recupera ventanas omitidas.

Al día 101 se añade un rasgo según historia: más juegos que caricias → Cola de cometa; si no → Brillo de luna. Solo expresivo. El aprendizaje de preferencias complejas está pendiente.

## Oportunidades y monetización — futuro

Oportunidades con inicio, fin, elegibilidad y recuperación única. Guardar fecha original y real de recuperación, sin alterar edad ni reescribir historial. Simular antes de cobrar. Cosméticos, decoraciones y experiencias recuperables sin ventaja; no vender aceleración ni usar azar pagado. El MVP no incluye compras, catálogo comercial o recuperación.

## Accesibilidad y relación saludable

Botones táctiles, etiquetas, valores textuales, `aria-live`, diseño adaptable y `prefers-reduced-motion`. Sin push, rachas ni culpa por ausencia. Límites de prueba visibles y compartidos consentidos.
