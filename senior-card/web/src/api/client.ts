// Same-origin API client. The web and the API share one public origin
// through nginx (`/api`), so no CORS handling is needed.
import type { CategoryName, PlaceDetail, PlacesResponse } from '../bridge/types';

const API_BASE = '/api/v1';
const TIMEOUT_MS = 15000;

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`api-${res.status}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('api-timeout');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchPlaces(
  category: CategoryName,
  lat: number,
  lng: number,
  limit = 20,
  subcategory?: string | null,
): Promise<PlacesResponse> {
  const params = new URLSearchParams({
    category,
    lat: String(lat),
    lng: String(lng),
    limit: String(limit),
  });
  if (subcategory) params.set('subcategory', subcategory);
  return getJson<PlacesResponse>(`/places?${params.toString()}`);
}

export function fetchPlace(id: string, lat: number | null, lng: number | null): Promise<PlaceDetail> {
  const params = new URLSearchParams();
  if (lat !== null && lng !== null) {
    params.set('lat', String(lat));
    params.set('lng', String(lng));
  }
  const query = params.toString();
  return getJson<PlaceDetail>(`/places/${encodeURIComponent(id)}${query ? `?${query}` : ''}`);
}

export function apiErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === 'api-timeout') return '連線逾時，請再試一次';
    if (e.message.startsWith('api-')) return '伺服器忙碌中，請稍後再試';
    return '網路連線有問題，請再試一次';
  }
  return '發生未知錯誤，請再試一次';
}
