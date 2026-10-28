// Shared readers for filter values that accept several shapes, so every DAO and the
// URL builder interpret GEO_RADIUS and BETWEEN filters the same way.

/** Reads `[lat, lng]`, `{ lat, lng }`, `{ lat, lon }`, or `{ latitude, longitude }`. */
export function readGeoPoint(raw: unknown): { lat: number; lng: number } | null {
  if (!raw) return null;

  let lat: number;
  let lng: number;

  if (Array.isArray(raw)) {
    if (raw.length < 2) return null;
    lat = Number(raw[0]);
    lng = Number(raw[1]);
  } else if (typeof raw === "object") {
    const point = raw as Record<string, unknown>;
    lat = Number(point["lat"] ?? point["latitude"]);
    lng = Number(point["lng"] ?? point["lon"] ?? point["longitude"]);
  } else {
    return null;
  }

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * Reads a GEO_RADIUS filter value: a center (`center`, or the point fields inline) and a
 * radius in meters (`radiusInM`, `radius`, `radiusMeters`) or kilometers (`radiusInKm`).
 */
export function readGeoRadius(raw: unknown): { lat: number; lng: number; radiusInM: number } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const value = raw as Record<string, unknown>;
  const center = readGeoPoint(value["center"] ?? value);
  const radiusInM =
    typeof value["radiusInM"] === "number" ? value["radiusInM"]
    : typeof value["radius"] === "number" ? value["radius"]
    : typeof value["radiusMeters"] === "number" ? value["radiusMeters"]
    : typeof value["radiusInKm"] === "number" ? value["radiusInKm"] * 1_000
    : undefined;

  if (!center || radiusInM === undefined || !Number.isFinite(radiusInM) || radiusInM < 0) {
    return null;
  }

  return { ...center, radiusInM };
}

/** Reads a BETWEEN filter value: `[min, max]`, `{ min, max }`, or `{ from, to }`. */
export function readBetweenBounds(raw: unknown): readonly [min: unknown, max: unknown] | null {
  if (Array.isArray(raw)) {
    return raw.length === 2 ? [raw[0], raw[1]] : null;
  }

  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    const min = value["min"] ?? value["from"];
    const max = value["max"] ?? value["to"];
    if (min !== undefined && max !== undefined) return [min, max];
  }

  return null;
}
