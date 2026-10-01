import { Kafka } from 'kafkajs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function supabaseHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid-or-missing';
  }
}

function keyPrefix(key) {
  if (!key) return 'missing';
  if (key.startsWith('sb_secret_')) return 'sb_secret_...';
  if (key.startsWith('eyJ')) return 'eyJ...';
  return 'present (unknown format)';
}

console.log('[worker] Supabase config', {
  urlConfigured: Boolean(supabaseUrl),
  hostname: supabaseHostname(supabaseUrl),
  serviceRoleKeyConfigured: Boolean(serviceRoleKey),
  serviceRoleKeyPrefix: keyPrefix(serviceRoleKey),
});

const supabase = createClient(supabaseUrl, serviceRoleKey);
const kafka = new Kafka({ clientId: 'agropulse-worker', brokers: [process.env.REDPANDA_BROKERS || 'redpanda:9092'] });
const consumer = kafka.consumer({ groupId: 'agropulse-worker' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await sleep(4000);
  await consumer.connect();
  await consumer.subscribe({ topic: 'soil.moisture', fromBeginning: false });
  console.log('[worker] ready');
  await consumer.run({ eachMessage: async ({ message }) => {
    try {
      const event = JSON.parse(message.value?.toString() ?? '{}');
      if (typeof event.station_id !== 'string' || typeof event.moisture_pct !== 'number' || typeof event.temp_c !== 'number') {
        throw new Error('invalid payload');
      }

      const { data: station, error: stationError } = await supabase
        .from('stations')
        .select('id')
        .eq('id', event.station_id)
        .maybeSingle();

      if (stationError) {
        console.error('[worker] station lookup error', {
          message: stationError.message,
          code: stationError.code,
          ...(stationError.details ? { details: stationError.details } : {}),
        });
        return;
      }

      if (station === null) {
        console.error('[worker] unknown station', event.station_id);
        return;
      }

      const { error } = await supabase.from('readings').insert({
        station_id: event.station_id,
        moisture_pct: event.moisture_pct,
        temp_c: event.temp_c,
        rain_mm: event.rain_mm ?? 0,
        measured_at: event.ts ?? new Date().toISOString(),
        source: 'sensor',
      });
      if (error) throw error;
      console.log('[worker] consumed', event.station_id);
      console.log('[worker] inserted reading ...');
    } catch (error) {
      console.error('[worker] invalid event', error instanceof Error ? error.message : error);
    }
  } });
}

async function commands() {
  while (true) {
    const { data } = await supabase.from('irrigation_commands').select('*').eq('status', 'pending').limit(20);
    for (const command of data ?? []) {
      console.log('[worker] applying irrigation command', command.id);
      await sleep(1500);
      const { error } = await supabase.from('valves').update({ status: command.action === 'open' ? 'open' : 'closed' }).eq('id', command.valve_id);
      if (error) {
        await supabase.from('irrigation_commands').update({ status: 'failed', error_reason: error.message }).eq('id', command.id);
        continue;
      }
      await supabase.from('irrigation_commands').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', command.id);
      console.log('[worker] command applied', command.id);
      if (command.action === 'open' && command.duration_min) {
        setTimeout(async () => {
          const { error: closeError } = await supabase.from('valves').update({ status: 'closed' }).eq('id', command.valve_id);
          if (closeError) console.error('[worker] scheduled close failed', closeError.message);
          else console.log('[worker] scheduled irrigation close', command.valve_id);
        }, command.duration_min * 60 * 1000);
      }
    }
    await sleep(1000);
  }
}

main().catch(console.error);
commands().catch(console.error);
