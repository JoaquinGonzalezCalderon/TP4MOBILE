# AgroPulse - informe academico

## Objetivo y arquitectura

AgroPulse es una demo de agricultura de precision. La frontera movil es `React Native <-> Supabase`: Auth, Postgres, RLS y Realtime. La frontera de eventos es independiente: `Simulator -> Redpanda -> Worker -> Supabase`. El telefono nunca consume Kafka.

## Modelo de datos y RLS

`organizations` y `memberships` determinan perimetro y rol. `plots` contiene umbrales y poligonos GeoJSON. `stations`, `readings`, `valves` e `irrigation_commands` modelan sensores y actuadores. Todas las tablas relevantes tienen RLS por membership. Producer modifica umbrales mediante `update_plot_threshold`; producer y operator solicitan comandos; advisor solo lee. Las RPC repiten las verificaciones server-side.

## GPS y geografia

El detalle solicita permiso foreground con `expo-location`, consulta la coordenada actual y usa `isPointInPolygon`. La funcion recibe puntos como latitude/longitude pero lee poligonos GeoJSON como `[longitude, latitude]`. Permisos denegados, GPS apagado y errores terminan en "Ubicacion no disponible" sin crash.

## Realtime y event-driven

`readings`, `valves` e `irrigation_commands` se publican en `supabase_realtime`. El detalle crea una unica suscripcion por montaje, la limpia al desmontar y refresca cada 3 segundos como fallback.

El simulador produce un tick cada 5 segundos con ruido pequeno. Solo conoce `STATION_IDS`, produce eventos a Redpanda y no recibe credenciales ni escribe en Supabase. `PAUSED_STATION_IDS` permite demostrar stale. El worker valida payloads, verifica la estacion, inserta lecturas y registra errores sin morir ante IDs desconocidos.

## Comandos, concurrencia e idempotencia

El worker consulta pending, espera aproximadamente 1,5 segundos, actualiza la valvula y marca applied. El indice parcial `one_pending_command_per_valve` evita dos pending concurrentes. `client_request_id` es UUID `NOT NULL UNIQUE`; la RPC devuelve el comando existente ante retry y captura los controles de rol, membership, valvula y duracion.

Para `open` con `duration_min`, el worker programa un cierre no bloqueante con `setTimeout`; no mantiene ocupado el loop durante los minutos de riego. Si el proceso se reinicia antes del vencimiento, ese cierre se pierde porque el TP no incorpora un scheduler persistente. `open` sin duracion deja la valvula abierta hasta una orden `close`.

## Flujo H1

Login -> establecimiento -> Costa 2 seca (18% frente a minimo 25%) -> orden de 30 minutos -> pending -> worker -> applied y valvula open, visible sin reiniciar. El semaforo centralizado evalua stale antes que dry, optimal y wet.

## Decisiones y limitaciones

Se uso Expo Router, TypeScript strict, `react-native-maps`, JSON GeoJSON y un grafico liviano de barras. El grafico inicia con 12 lecturas historicas por estacion desde el seed. Las coordenadas, humedad, clima, ubicacion y GPS son ficticios y solo tienen fines academicos.
