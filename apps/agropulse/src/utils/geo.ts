export type GeoPoint = { latitude: number; longitude: number };
export type GeoJsonPolygon = { type: 'Polygon'; coordinates: number[][][] };

/** GeoJSON uses [longitude, latitude]. Boundary points count as inside. */
export function isPointInPolygon(point: GeoPoint, polygon: GeoJsonPolygon): boolean {
  const ring = polygon.coordinates[0] ?? [];
  if (ring.length < 3) return false;
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i];
    const previous = ring[j];
    if (!current || !previous) continue;
    const xi = current[0]; const yi = current[1];
    const xj = previous[0]; const yj = previous[1];
    if (xi === undefined || yi === undefined || xj === undefined || yj === undefined) continue;
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    const within = x >= Math.min(xi, xj) && x <= Math.max(xi, xj) && y >= Math.min(yi, yj) && y <= Math.max(yi, yj);
    if (Math.abs(cross) < 1e-10 && within) return true;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
