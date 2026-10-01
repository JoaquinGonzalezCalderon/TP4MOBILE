import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { createClientRequestId, getPlotBundle, requestIrrigation, subscribePlot, updateThreshold } from '@/services/data';
import { supabase } from '@/lib/supabase';
import { useAgroContext } from '@/hooks/useAgroContext';
import type { Command, Plot, Reading, Valve } from '@/types/domain';
import { formatAge, getPlotStatus, STATUS_COLORS, STATUS_LABELS } from '@/utils/plotStatus';
import { isPointInPolygon } from '@/utils/geo';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState } from '@/components/LoadingState';

type LocationState = 'loading' | 'inside' | 'outside' | 'unavailable';
const actionLabel = { open: 'Abrir', close: 'Cerrar' } as const;

export default function PlotDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAgroContext();
  const [plot, setPlot] = useState<Plot | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [duration, setDuration] = useState('30');
  const [busyCommand, setBusyCommand] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>('loading');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [thresholdText, setThresholdText] = useState('');
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const thresholdInitialized = useRef<string | null>(null);
  const requestIds = useRef<Record<string, string>>({});
  const plotRef = useRef<Plot | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data: rawPlot, error } = await supabase.from('plots').select('*').eq('id', id).single();
      if (error) throw error;
      const nextPlot = rawPlot as Plot;
      plotRef.current = nextPlot;
      setPlot(nextPlot);
      if (thresholdInitialized.current !== id) {
        setThresholdText(String(nextPlot.threshold_min));
        thresholdInitialized.current = id;
      }
      const bundle = await getPlotBundle(id);
      setReadings(bundle.readings);
      setReading(bundle.readings.at(-1) ?? null);
      setValves(bundle.valves);
      setCommands(bundle.commands);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el lote');
    }
  }, [id]);

  const locate = useCallback(async () => {
    setLocationState('loading');
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationState('unavailable');
        setLocationError('Permiso de ubicación denegado');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setLocationState('unavailable');
        setLocationError('GPS desactivado');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const currentPlot = plotRef.current;
      if (!currentPlot) {
        setLocationState('unavailable');
        return;
      }
      setLocationState(isPointInPolygon({ latitude: current.coords.latitude, longitude: current.coords.longitude }, currentPlot.polygon) ? 'inside' : 'outside');
    } catch (error) {
      setLocationState('unavailable');
      setLocationError(error instanceof Error ? error.message : 'No se pudo obtener la ubicación');
    }
  }, []);

  useEffect(() => {
    void load();
    if (!id) return;
    const channel = subscribePlot(id, () => { void load(); });
    const timer = setInterval(() => { void load(); }, 3000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    if (plot?.id) void locate();
  }, [plot?.id, locate]);

  async function saveThreshold() {
    const value = Number(thresholdText);
    if (!plot || !Number.isFinite(value) || value < 0 || value > 100 || value > plot.threshold_max) {
      Alert.alert('Umbral inválido', `Ingresá un valor entre 0 y ${plot?.threshold_max ?? 100}.`);
      return;
    }
    setSavingThreshold(true);
    try {
      const updated = await updateThreshold(plot.id, value);
      plotRef.current = updated;
      setPlot(updated);
      setThresholdText(String(updated.threshold_min));
      Alert.alert('Umbral actualizado', 'El semáforo fue recalculado.');
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Sólo un producer puede editar umbrales.');
    } finally {
      setSavingThreshold(false);
    }
  }

  async function issueCommand(valve: Valve, action: 'open' | 'close', minutes: number | null) {
    if (role === 'advisor') return;
    const key = `${valve.id}:${action}:${minutes ?? 'none'}`;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 120)) {
      Alert.alert('Duración inválida', 'Usá un valor entre 1 y 120 minutos.');
      return;
    }
    const requestId = requestIds.current[key] ?? createClientRequestId();
    requestIds.current[key] = requestId;
    setBusyCommand(key);
    try {
      const command = await requestIrrigation(valve.id, action, minutes, requestId);
      delete requestIds.current[key];
      setCommands(previous => [command, ...previous.filter(item => item.id !== command.id)]);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      Alert.alert('No se pudo emitir', message.includes('one_pending') || message.includes('duplicate') ? 'Ya hay una orden de riego pendiente para esta válvula.' : message || 'Error de comando');
    } finally {
      setBusyCommand(null);
    }
  }

  if (loadError && !plot) return <View style={s.center}><Text>{loadError}</Text><Pressable onPress={() => { void load(); }}><Text style={s.link}>Reintentar</Text></Pressable></View>;
  if (!plot) return <LoadingState label="Cargando lote..." />;
  const status = getPlotStatus(reading, plot.threshold_min, plot.threshold_max);
  return <ScrollView style={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}><Pressable onPress={() => router.back()}><Text style={s.back}>‹ Volver</Text></Pressable><Text style={s.title}>{plot.name}</Text><Text>{plot.crop ?? 'Sin cultivo'}</Text>
    <View style={s.hero}><StatusBadge status={status} /><Text style={s.moisture}>{reading?.moisture_pct ?? '—'} %</Text><Text>Humedad · mínimo {plot.threshold_min}% · máximo {plot.threshold_max}%</Text></View>
    <View style={s.card}><Text style={s.section}>Estoy en el lote</Text>{locationState === 'loading' ? <Text>Consultando ubicación...</Text> : locationState === 'inside' ? <Text style={s.success}>Estás dentro del lote</Text> : locationState === 'outside' ? <Text style={s.warning}>No estás dentro del lote</Text> : <Text style={s.warning}>Ubicación no disponible{locationError ? ` · ${locationError}` : ''}</Text>}<Pressable onPress={() => { void locate(); }}><Text style={s.link}>Actualizar ubicación</Text></Pressable></View>
    <View style={s.card}><Text style={s.section}>Lectura actual</Text><Text>Temperatura: {reading?.temp_c ?? '—'} °C</Text><Text>Lluvia: {reading?.rain_mm ?? 0} mm</Text><Text>Última lectura: {reading ? formatAge(reading.measured_at) : 'Sin datos'}</Text><Text style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</Text></View>
    <View style={s.card}><Text style={s.section}>Humedad · últimas 6 horas</Text><View style={s.chart}>{readings.slice(-12).map(item => <View key={item.id} style={s.barWrap}><View style={[s.bar, { height: Math.max(8, item.moisture_pct * 1.3) }]} /><Text style={s.barLabel}>{Math.round(item.moisture_pct)}</Text></View>)}</View><Text style={s.muted}>{readings.length} puntos provenientes de Postgres</Text></View>
    <View style={s.card}><Text style={s.section}>Umbral de riego</Text><Text>Humedad mínima: {plot.threshold_min} %</Text>{role === 'producer' ? <View style={s.row}><TextInput style={s.durationInput} keyboardType="decimal-pad" value={thresholdText} onChangeText={setThresholdText} /><Text>%</Text><Pressable style={s.button} disabled={savingThreshold} onPress={() => { void saveThreshold(); }}><Text style={s.buttonText}>{savingThreshold ? 'Guardando...' : 'Guardar'}</Text></Pressable></View> : <Text style={s.muted}>Sólo producer puede editar umbrales.</Text>}</View>
    <View style={s.card}><Text style={s.section}>Válvulas</Text>{valves.length === 0 ? <Text style={s.muted}>Este lote no tiene válvulas.</Text> : valves.map(valve => { const command = commands.find(item => item.valve_id === valve.id); const openKey = `${valve.id}:open:none`; const closeKey = `${valve.id}:close:none`; const waterKey = `${valve.id}:open:${duration}`; return <View key={valve.id} style={s.valve}><Text style={s.valveName}>{valve.name}</Text><Text>Estado: {valve.status === 'open' ? 'open' : 'closed'}</Text>{command && <View style={s.command}><Text>Último comando: {command.status}</Text><Text>Acción: {actionLabel[command.action]}{command.duration_min ? ` · ${command.duration_min} min` : ''}</Text><Text>Creado: {new Date(command.created_at).toLocaleString()}</Text>{command.status === 'failed' && <Text style={s.warning}>Error: {command.error_reason ?? 'sin detalle'}</Text>}</View>}{role !== 'advisor' && <><View style={s.row}><Pressable style={s.smallButton} disabled={busyCommand !== null} onPress={() => { void issueCommand(valve, 'open', null); }}><Text style={s.buttonText}>{busyCommand === openKey ? '...' : 'Abrir'}</Text></Pressable><Pressable style={s.smallButton} disabled={busyCommand !== null} onPress={() => { void issueCommand(valve, 'close', null); }}><Text style={s.buttonText}>{busyCommand === closeKey ? '...' : 'Cerrar'}</Text></Pressable></View><View style={s.row}><TextInput style={s.durationInput} keyboardType="number-pad" value={duration} onChangeText={setDuration} /><Text>min</Text><Pressable style={s.button} disabled={busyCommand !== null} onPress={() => { void issueCommand(valve, 'open', Number(duration)); }}><Text style={s.buttonText}>{busyCommand === waterKey ? 'Enviando...' : 'Regar N minutos'}</Text></Pressable></View></>}</View>; })}</View>
  </ScrollView>;
}

const s = StyleSheet.create({ page: { flex: 1, padding: 18, backgroundColor: '#F8FAFC' }, back: { color: '#166534', fontWeight: '700', marginBottom: 12 }, title: { fontSize: 30, fontWeight: '800', color: '#14532D' }, hero: { backgroundColor: '#ECFDF5', padding: 18, borderRadius: 16, marginTop: 18, gap: 8 }, moisture: { fontSize: 40, fontWeight: '800', color: '#14532D' }, card: { backgroundColor: 'white', borderRadius: 14, padding: 16, marginTop: 14, gap: 8 }, section: { fontSize: 18, fontWeight: '800' }, chart: { height: 170, flexDirection: 'row', alignItems: 'flex-end', gap: 5 }, barWrap: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 }, bar: { width: 12, backgroundColor: '#16A34A', borderRadius: 5 }, barLabel: { fontSize: 9 }, muted: { color: '#64748B' }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }, durationInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 9, width: 65 }, button: { backgroundColor: '#166534', padding: 12, borderRadius: 9, flex: 1, alignItems: 'center' }, smallButton: { backgroundColor: '#166534', padding: 10, borderRadius: 9, flex: 1, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '800' }, success: { color: '#166534', fontWeight: '800' }, warning: { color: '#B45309', fontWeight: '700' }, link: { color: '#166534', fontWeight: '700' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, valve: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12, marginTop: 8, gap: 5 }, valveName: { fontSize: 16, fontWeight: '800' }, command: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, gap: 3 } });
