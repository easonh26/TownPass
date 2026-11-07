// Minimal shared store (no router / pinia needed for 4 fixed screens).
import { reactive } from 'vue';
import type { CategoryName, GeoPosition } from './bridge/types';

export type ViewName = 'voice' | 'categories' | 'list' | 'detail';

const VOICE_KEY = 'senior-card-voice-on';

function loadVoiceOn(): boolean | null {
  try {
    const raw = localStorage.getItem(VOICE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // localStorage may be unavailable in some WebViews.
  }
  return null;
}

export const store = reactive({
  view: 'voice' as ViewName,
  // P0 asks every launch, so always start undecided; persisted only as default.
  voiceOn: false as boolean,
  voiceAsked: false as boolean,
  location: null as GeoPosition | null,
  locationFailed: false as boolean,
  category: null as CategoryName | null,
  placeId: null as string | null,
  listPage: 0,
  // Bumped every time a new query starts so ResultListView remounts.
  querySeq: 0,
});

export function persistVoiceDefault(on: boolean): void {
  try {
    localStorage.setItem(VOICE_KEY, on ? '1' : '0');
  } catch {
    // Best effort only.
  }
}

export function voiceDefault(): boolean {
  return loadVoiceOn() ?? false;
}

export function go(view: ViewName): void {
  store.view = view;
}
