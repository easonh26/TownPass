// Voice helper: Taigi-first with automatic Mandarin fallback.
// Views call say(mandarinText, taigiPhonemes?) instead of speak() directly:
// - voiceLang 'taigi' + valid phonemes -> native VITS; on any failure,
//   falls back to Mandarin so the user always hears something.
// - voiceLang 'mandarin' -> Mandarin system/native TTS.
// - 'off' -> silent.
import { store } from '../store';
import { useTts } from './useTts';

export function useVoice() {
  const { speak, speakTaigi, stop, supported, taigiSupported, isInApp } = useTts();

  async function say(mandarin: string, taigi?: string | null, onWaiting?: () => void): Promise<void> {
    if (store.voiceLang === 'taigi' && taigi && taigi.trim()) {
      const ok = await speakTaigi(taigi, onWaiting);
      if (ok) return;
      // fall through to Mandarin
    }
    if (store.voiceLang !== 'off' && mandarin.trim()) {
      await speak(mandarin);
    }
  }

  return { say, speak, speakTaigi, stop, supported, taigiSupported, isInApp };
}
