# AgroPulse

Demo academica de agricultura de precision. Los datos de humedad, clima, ubicacion y GPS son ficticios y tienen fines academicos.

## Arquitectura

```text
React Native/Expo <-> Supabase Auth/Postgres/RLS/Realtime
Simulator -> Redpanda soil.moisture -> Worker -> Supabase -> Realtime -> App
```

La app movil solo usa `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Nunca contiene service role, Kafka ni MQTT.

## Requisitos

- Node.js 20+
- Expo Go o development build para Android/iOS
- Proyecto Supabase
- Docker Desktop para Redpanda, worker y simulator

## Variables de entorno

Para la app:

```powershell
Copy-Item apps/agropulse/.env.example apps/agropulse/.env
```

Completar `apps/agropulse/.env` con las dos variables `EXPO_PUBLIC_`.

Para Docker se usa UNA sola fuente: el `.env` de la raiz.

```powershell
Copy-Item .env.example .env
```

Completar en ese archivo `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDPANDA_BROKERS`, `STATION_IDS` y opcionalmente `PAUSED_STATION_IDS`. La service role solo se inyecta al worker.

## Supabase, migraciones y seed

1. Crear un proyecto Supabase.
2. Ejecutar `supabase/migrations/001_agropulse.sql` en SQL Editor.
3. Ejecutar `supabase/migrations/002_authenticated_grants.sql` en SQL Editor.
4. Ejecutar `supabase/seed.sql`.
5. Crear usuarios Auth: `productor@agropulse.test`, `operador@agropulse.test`, `asesor@agropulse.test`.
6. Reemplazar los UUID en `supabase/demo_memberships.sql` y ejecutar ese archivo.

## Docker

Desde la raiz:

```powershell
docker compose --env-file .env -f infra/docker-compose.yml config
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

El simulator solo publica eventos con los UUID de `STATION_IDS`; no consulta ni escribe Supabase. El worker inserta readings y procesa comandos. Para demostrar stale, agregar una estación a `PAUSED_STATION_IDS` y esperar más de 15 minutos.

## Ejecutar Expo

```powershell
cd apps/agropulse
npm install
npm run typecheck
npm test
npm run lint
npx expo start
```

## Usuarios y roles

- `productor@agropulse.test`: thresholds y riego.
- `operador@agropulse.test`: riego.
- `asesor@agropulse.test`: lectura.

Las passwords se crean manualmente en Supabase y no se guardan en el repositorio.

## Happy Path H1

1. Login como producer.
2. Seleccionar `Estancia Didactica Concordia`.
3. Abrir `Costa 2`: 18%, threshold minimo 25%, estado seco.
4. En una valvula elegir `Regar N minutos` y usar 30.
5. Ver el ultimo comando como `pending`.
6. El worker lo cambia a `applied` y abre la valvula.
7. Realtime actualiza la pantalla sin reiniciar.

`duration_min` programa un cierre no bloqueante en el worker con `setTimeout`. Si el worker se reinicia antes del vencimiento, ese cierre programado se pierde; la demo no agrega un scheduler persistente fuera del alcance del TP.

## RLS, RF-16 y diagnostico

Cambiar IDs desde el cliente no permite leer datos de otra organizacion. Dos comandos pending para una misma valvula son rechazados por el indice parcial. Cuenta -> Diagnostico muestra user id, organizacion, rol, ultimo reading visible, timestamp y lag calculado.

## Troubleshooting

- `401`: revisar URL, anon key y usuario confirmado.
- `403`: revisar membership y rol.
- Sin Realtime: el detalle refresca cada 3 segundos.
- Docker no conecta: revisar URL/service role del `.env` raiz.
