# Checklist PRD

| Requisito | Estado | Implementacion | Como demostrarlo |
|---|---|---|---|
| RF-01 Login/logout | ✅ | Supabase Auth + AsyncStorage + guard de rutas | cerrar/reabrir y logout |
| RF-02 aislamiento establecimientos | ✅ | memberships + RLS por organizacion | cambiar UUID manualmente |
| RF-03 selector establecimiento | ✅ | selector compartido en Cuenta | cambiar organizacion |
| RF-04 listar lotes | ✅ | plots + listado | pestaña Lotes |
| RF-05 mapa/poligonos | ✅ | react-native-maps + Polygon + leyenda | pestaña Mapa |
| RF-06 GPS dentro del poligono | ✅ | expo-location + point-in-polygon | detalle de lote |
| RF-07 alta/edicion lote | ⏳ Should | no implementado | — |
| RF-08 estaciones/lecturas | ✅ | stations + readings + worker | seed y logs |
| RF-09 ultima lectura/antiguedad/stale | ✅ | lectura actual + getPlotStatus | Monte A/Costa 2 |
| RF-10 grafico 6 h | ✅ | datos Postgres + 12 puntos seed | detalle |
| RF-11 umbral configurable | ✅ | input producer + RPC protegida | cambiar 25 a 15 |
| RF-12 semaforo | ✅ | getPlotStatus centralizada | dry/optimal/stale |
| RF-13 listar valvulas | ✅ | todas las valves del lote | agregar segunda valve |
| RF-14 abrir/cerrar/duration | ✅ | Abrir, Cerrar y Regar N minutos | detalle |
| RF-15 pending -> applied/failed | ✅ | commands consultados + Realtime + worker | emitir comando |
| RF-16 un solo pending | ✅ | indice partial unique por valve_id | dos comandos rapidos |
| RF-17 cancelar | ⏳ Should | no implementado | — |
| RF-18 historial 20 comandos | ⏳ Should | no implementado | — |
| RF-19 alerta dry | ⏳ Should | no implementado | — |
| RF-20 alerta stale | ⏳ Should | no implementado | — |
| RF-21 lectura manual/offline | ⏳ Should | no implementado | — |
| RF-22 sugerencia | ⏳ Could | no implementado | — |
| RF-23 diagnostico | ✅ | user, org, rol, ultimo reading, timestamp y lag real | Cuenta -> Diagnostico |
| RF-24 logs worker | ✅ | logs de simulator y worker | Docker |

## No funcionales Must

| Requisito | Estado | Implementacion |
|---|---|---|
| RNF-01 Expo + TypeScript strict + Expo Router | ✅ | package y tsconfig |
| RNF-02 secretos fuera del binario | ✅ | solo anon key en mobile; service role solo worker |
| RNF-03 mapa usable | ✅ | region inicial Concordia + lista alternativa |
| RNF-04 tick visible | ✅ | simulator 5 s + worker + Realtime + fallback 3 s |
| RNF-05 errores 401/403/comando | ✅ | estados y mensajes controlados |
| RNF-06 README reproducible | ✅ | comandos y variables coherentes |
| RNF-10 datos ficticios | ✅ | Cuenta, README e informe |

Decision: producer es el unico rol que modifica umbrales mediante RPC server-side; operator opera riego y advisor solo lee. `duration_min` programa un cierre no bloqueante en el worker; si el worker reinicia antes del vencimiento, el cierre se pierde porque no hay scheduler persistente en el alcance del TP.
