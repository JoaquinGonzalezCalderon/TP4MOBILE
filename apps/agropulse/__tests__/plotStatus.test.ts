import { getPlotStatus } from '@/utils/plotStatus'; const now=new Date('2026-01-01T12:00:00Z');
test('sin reading es stale',()=>expect(getPlotStatus(null,25,45,now)).toBe('stale'));
test('reading de más de 15 minutos es stale',()=>expect(getPlotStatus({measured_at:'2026-01-01T11:44:59Z',moisture_pct:30},25,45,now)).toBe('stale'));
test('18 es dry',()=>expect(getPlotStatus({measured_at:'2026-01-01T11:59:00Z',moisture_pct:18},25,45,now)).toBe('dry'));
test('30 es optimal',()=>expect(getPlotStatus({measured_at:'2026-01-01T11:59:00Z',moisture_pct:30},25,45,now)).toBe('optimal'));
test('50 es wet',()=>expect(getPlotStatus({measured_at:'2026-01-01T11:59:00Z',moisture_pct:50},25,45,now)).toBe('wet'));
