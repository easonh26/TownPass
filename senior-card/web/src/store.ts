// Minimal shared store (no router / pinia needed for 4 fixed screens).
import { reactive } from 'vue';
import type { CategoryName, GeoPosition } from './bridge/types';

export type ViewName = 'voice' | 'categories' | 'transport' | 'list' | 'detail';

export type TransportName = '公車' | '捷運' | '臺鐵' | '貓空纜車';

export type VoiceLang = 'off' | 'mandarin' | 'taigi';

const VOICE_KEY = 'senior-card-voice-on';

function loadVoiceLang(): VoiceLang {
  try {
    const raw = localStorage.getItem(VOICE_KEY);
    if (raw === '2') return 'taigi';
    if (raw === '1') return 'mandarin';
  } catch {
    // localStorage may be unavailable in some WebViews.
  }
  return 'off';
}

export const store = reactive({
  view: 'voice' as ViewName,
  // P0 asks every launch, so always start undecided; persisted only as default.
  voiceLang: 'off' as VoiceLang,
  voiceAsked: false as boolean,
  location: null as GeoPosition | null,
  locationFailed: false as boolean,
  category: null as CategoryName | null,
  transport: null as TransportName | null,
  placeId: null as string | null,
  listPage: 0,
  // Bumped every time a new query starts so ResultListView remounts.
  querySeq: 0,
});

export function persistVoiceDefault(lang: VoiceLang): void {
  try {
    localStorage.setItem(VOICE_KEY, lang === 'taigi' ? '2' : lang === 'mandarin' ? '1' : '0');
  } catch {
    // Best effort only.
  }
}

export function voiceDefault(): VoiceLang {
  return loadVoiceLang();
}

export function go(view: ViewName): void {
  store.view = view;
}
