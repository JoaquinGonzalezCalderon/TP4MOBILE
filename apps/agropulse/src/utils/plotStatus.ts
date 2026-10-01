import type { PlotStatus, Reading } from '@/types/domain';
export function getPlotStatus(reading: Pick<Reading,'measured_at'|'moisture_pct'>|null|undefined, thresholdMin:number, thresholdMax:number, now = new Date()): PlotStatus {
  if (!reading || now.getTime() - new Date(reading.measured_at).getTime() > 15 * 60 * 1000) return 'stale';
  if (reading.moisture_pct < thresholdMin) return 'dry';
  if (reading.moisture_pct <= thresholdMax) return 'optimal';
  return 'wet';
}
export const STATUS_LABELS: Record<PlotStatus,string> = { stale:'Sin datos', dry:'Seco', optimal:'Óptimo', wet:'Húmedo' };
export const STATUS_COLORS: Record<PlotStatus,string> = { stale:'#64748B', dry:'#DC2626', optimal:'#16A34A', wet:'#2563EB' };
export function formatAge(value:string, now=new Date()):string { const seconds=Math.max(0,Math.floor((now.getTime()-new Date(value).getTime())/1000)); if(seconds<60)return `hace ${seconds} s`; const minutes=Math.floor(seconds/60); if(minutes<60)return `hace ${minutes} min`; return `hace ${Math.floor(minutes/60)} h`; }
