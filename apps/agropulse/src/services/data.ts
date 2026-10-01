import { supabase } from '@/lib/supabase';
import type { Command, Organization, Plot, Reading, Role, Station, Valve } from '@/types/domain';

export async function getOrganizations():Promise<Organization[]> { const {data,error}=await supabase.from('organizations').select('id,name,region').order('name'); if(error)throw error; return data as Organization[]; }
export async function getRole(userId:string, organizationId:string):Promise<Role|null> { const {data,error}=await supabase.from('memberships').select('role').eq('user_id',userId).eq('organization_id',organizationId).maybeSingle(); if(error)throw error; return (data?.role as Role | undefined) ?? null; }
export async function getPlots(orgId:string):Promise<Plot[]> { const {data,error}=await supabase.from('plots').select('*').eq('organization_id',orgId).order('name'); if(error)throw error; return data as Plot[]; }

export async function getPlotBundle(plotId:string) {
  const [stationResult,valveResult]=await Promise.all([supabase.from('stations').select('*').eq('plot_id',plotId),supabase.from('valves').select('*').eq('plot_id',plotId)]);
  if(stationResult.error)throw stationResult.error; if(valveResult.error)throw valveResult.error;
  const stations=stationResult.data as Station[]; const station=stations[0]; const valves=valveResult.data as Valve[];
  const {data:readings,error:readingsError}=station?await supabase.from('readings').select('*').eq('station_id',station.id).gte('measured_at',new Date(Date.now()-6*60*60*1000).toISOString()).order('measured_at'):({data:[],error:null} as const);
  if(readingsError)throw readingsError;
  const valveIds=valves.map(valve=>valve.id); let commands:Command[]=[];
  if(valveIds.length){const {data,error}=await supabase.from('irrigation_commands').select('*').in('valve_id',valveIds).order('created_at',{ascending:false});if(error)throw error;commands=(data??[]) as Command[];}
  return {station,readings:(readings??[]) as Reading[],valves,commands};
}

export async function getLatestReadingForOrganization(orgId:string):Promise<Reading|null>{
  const {data:plots,error:plotsError}=await supabase.from('plots').select('id').eq('organization_id',orgId); if(plotsError)throw plotsError;
  const plotIds=(plots??[]).map(plot=>plot.id as string); if(!plotIds.length)return null;
  const {data:stations,error:stationsError}=await supabase.from('stations').select('id').in('plot_id',plotIds); if(stationsError)throw stationsError;
  const stationIds=(stations??[]).map(station=>station.id as string); if(!stationIds.length)return null;
  const {data,error}=await supabase.from('readings').select('*').in('station_id',stationIds).order('measured_at',{ascending:false}).limit(1); if(error)throw error; return (data?.[0] as Reading|undefined) ?? null;
}

function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;const v=c==='x'?r:(r&0x3|0x8);return v.toString(16)})}
export function createClientRequestId():string{return uuid()}
export async function requestIrrigation(valveId:string, action:'open'|'close', duration:number|null, clientRequestId=uuid()):Promise<Command> { const {data,error}=await supabase.rpc('request_irrigation',{p_valve_id:valveId,p_action:action,p_duration_min:duration,p_client_request_id:clientRequestId}); if(error)throw error; return data as Command; }
export async function updateThreshold(plotId:string, thresholdMin:number):Promise<Plot>{ const {data,error}=await supabase.rpc('update_plot_threshold',{p_plot_id:plotId,p_threshold_min:thresholdMin}); if(error)throw error; return data as Plot; }
export function subscribePlot(plotId:string,onChange:()=>void) { return supabase.channel(`plot-${plotId}`).on('postgres_changes',{event:'*',schema:'public',table:'readings'},onChange).on('postgres_changes',{event:'*',schema:'public',table:'valves',filter:`plot_id=eq.${plotId}`},onChange).on('postgres_changes',{event:'*',schema:'public',table:'irrigation_commands'},onChange).subscribe(); }
