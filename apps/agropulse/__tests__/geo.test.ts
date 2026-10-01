import { isPointInPolygon } from '@/utils/geo';
const square={type:'Polygon' as const,coordinates:[[[-58.02,-31.38],[-58.01,-31.38],[-58.01,-31.37],[-58.02,-31.37],[-58.02,-31.38]]]};
test('point inside polygon',()=>expect(isPointInPolygon({longitude:-58.015,latitude:-31.375},square)).toBe(true));
test('point outside polygon',()=>expect(isPointInPolygon({longitude:-58.05,latitude:-31.4},square)).toBe(false));
test('point on polygon edge is inside',()=>expect(isPointInPolygon({longitude:-58.02,latitude:-31.375},square)).toBe(true));
