// Location through the App's built-in `location` handler.
// The App replies with Position JSON on success, or [] on failure
// (permission denied / service disabled).
import { ref } from 'vue';
import { callNative, isInApp } from '../bridge/native';
import type { GeoPosition } from '../bridge/types';

const LOCATION_TIMEOUT_MS = 20000;

function isPosition(data: unknown): data is GeoPosition {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.latitude === 'number' && typeof d.longitude === 'number';
}

export function useLocation() {
  const locating = ref(false);
  const failed = ref(false);

  async function locate(): Promise<GeoPosition | null> {
    locating.value = true;
    failed.value = false;
    try {
      // No flutterObject (desktop browser): fall back to Geolocation API
      // so the UI can still be developed and tested.
      if (!isInApp() && 'geolocation' in navigator) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: LOCATION_TIMEOUT_MS });
        });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
      const data = await callNative<unknown>('location', null, LOCATION_TIMEOUT_MS);
      if (isPosition(data)) return data;
      failed.value = true;
      return null;
    } catch {
      failed.value = true;
      return null;
    } finally {
      locating.value = false;
    }
  }

  return { locating, failed, locate };
}
