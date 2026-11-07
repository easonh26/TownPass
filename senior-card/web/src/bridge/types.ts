// Types for the flutterObject bridge and the senior-card API.
// The bridge protocol is: postMessage(JSON { name, data }) and the App
// replies with a WebMessage whose data is JSON { name, data }.

export interface FlutterObject {
  postMessage(message: string): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

declare global {
  interface Window {
    flutterObject?: FlutterObject;
  }
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
}

export interface TtsCheckResult {
  available?: boolean;
}

export type TtsSpeakResult = 'done' | 'stopped' | 'error' | { error?: string } | null;

export interface PlaceItem {
  id: string;
  name: string;
  subCategory: string;
  address: string;
  lat: number;
  lng: number;
  points: number;
  discountInfo: string;
  distanceMeters: number | null;
}

export interface PlacesResponse {
  radiusMeters: number;
  items: PlaceItem[];
}

export interface PlaceDetail extends PlaceItem {
  benefits: string[];
}

export type CategoryName = '交通' | '娛樂' | '運動' | '醫療';

export const CATEGORIES: CategoryName[] = ['交通', '娛樂', '運動', '醫療'];
