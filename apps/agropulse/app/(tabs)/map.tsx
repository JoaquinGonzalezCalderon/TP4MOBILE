import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAgroContext } from '@/hooks/useAgroContext';
import { getPlotBundle } from '@/services/data';
import type { Reading } from '@/types/domain';
import { LoadingState } from '@/components/LoadingState';
import PlotMap from '@/components/PlotMap';

export default function MapScreen() {
  const { plots, loading, error, org } = useAgroContext();
  const [readings, setReadings] = useState<Record<string, Reading | null>>({});
  useEffect(() => {
    plots.forEach(plot => {
      void getPlotBundle(plot.id).then(bundle => {
        setReadings(previous => ({ ...previous, [plot.id]: bundle.readings.at(-1) ?? null }));
      }).catch(() => undefined);
    });
  }, [plots]);
  if (loading) return <LoadingState />;
  if (error) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>{error}</Text></View>;
  return <PlotMap plots={plots} readings={readings} organizationName={org?.name} />;
}
