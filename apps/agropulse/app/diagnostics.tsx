import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getLatestReadingForOrganization } from '@/services/data';
import { useAgroContext } from '@/hooks/useAgroContext';
import type { Reading } from '@/types/domain';

function lagLabel(reading: Reading | null, now: number) {
  if (!reading) return 'Sin lecturas';
  const seconds = Math.max(0, Math.floor((now - new Date(reading.measured_at).getTime()) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min`;
}

export default function Diagnostics() {
  const { org, role } = useAgroContext();
  const [user, setUser] = useState('—');
  const [reading, setReading] = useState<Reading | null>(null);
  const [now, setNow] = useState(Date.now());
  const [realtime, setRealtime] = useState('CONNECTING');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    const orgId = org.id;
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data.user?.id ?? '—');
    });
    async function load() {
      try {
        const latest = await getLatestReadingForOrganization(orgId);
        if (mounted) {
          setReading(latest);
          setNow(Date.now());
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'No se pudo cargar el diagnóstico');
      }
    }
    void load();
    const channel = supabase.channel(`diagnostics-${orgId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, () => { void load(); }).subscribe(status => {
      if (mounted) setRealtime(status);
    });
    const timer = setInterval(() => { void load(); }, 3000);
    return () => {
      mounted = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [org]);

  return <View style={{ padding: 22, gap: 14, backgroundColor: '#F8FAFC', flex: 1 }}><Text style={{ fontSize: 28, fontWeight: '800', color: '#14532D' }}>Diagnóstico</Text><Text>Usuario: {user}</Text><Text>Organización activa: {org?.name ?? '—'}</Text><Text>Rol: {role ?? '—'}</Text><Text>Realtime: {realtime}</Text><Text>Último reading: {reading?.measured_at ?? 'Sin lecturas'}</Text><Text>Lag actual: {lagLabel(reading, now)}</Text>{error && <Text style={{ color: '#B91C1C' }}>Error: {error}</Text>}</View>;
}
