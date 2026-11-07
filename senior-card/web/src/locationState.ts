// Shared location state: locating starts on P0 choice (background) and
// ResultList awaits it before querying the API.
import { reactive } from 'vue';
import { callNative, isInApp } from './bridge/native';
import type { GeoPosition } from './bridge/types';

const LOCATION_TIMEOUT_MS = 20000;

export type LocationStatus = 'idle' | 'locating' | 'ready' | 'failed';

export const locationState = reactive({
  status: 'idle' as LocationStatus,
  position: null as GeoPosition | null,
});

function isPosition(data: unknown): data is GeoPosition {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.latitude === 'number' && typeof d.longitude === 'number';
}

let inflight: Promise<boolean> | null = null;

export function ensureLocation(): Promise<boolean> {
  if (locationState.status === 'ready') return Promise.resolve(true);
  if (inflight) return inflight;
  inflight = (async () => {
    locationState.status = 'locating';
    try {
      let pos: GeoPosition | null = null;
      if (!isInApp() && 'geolocation' in navigator) {
        // Browser fallback for development / testing.
        const gp = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: LOCATION_TIMEOUT_MS });
        });
        pos = { latitude: gp.coords.latitude, longitude: gp.coords.longitude };
      } else {
        const data = await callNative<unknown>('location', null, LOCATION_TIMEOUT_MS);
        if (isPosition(data)) pos = data;
      }
      if (pos) {
        locationState.position = pos;
        locationState.status = 'ready';
        return true;
      }
      locationState.status = 'failed';
      return false;
    } catch {
      locationState.status = 'failed';
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function retryLocation(): Promise<boolean> {
  locationState.status = 'idle';
  return ensureLocation();
}
