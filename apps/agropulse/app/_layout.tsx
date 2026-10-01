import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { LoadingState } from '@/components/LoadingState';
import { View } from 'react-native';
import { AgroProvider } from '@/hooks/useAgroContext';

export default function Layout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) void router.replace('/login');
    if (session && inAuth) void router.replace('/map');
  }, [ready, session, segments, router]);

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><LoadingState /></View>;
  return <AgroProvider><Stack screenOptions={{ headerShown: false }} /></AgroProvider>;
}
