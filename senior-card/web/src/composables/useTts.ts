// Text-to-speech with engine selection:
//   1. Web Speech API (works in iOS WKWebView / desktop browsers)
//   2. Native App TTS via tts_check / tts_speak / tts_stop (Android WebView
//      has no Web Speech API, so the App speaks instead)
//   3. None (visual only + status hint)
// Selection runs once per page load; every speak() stops the previous one.
import { ref } from 'vue';
import { callNative, isInApp, postNative } from '../bridge/native';
import type { TtsCheckResult, TtsSpeakResult } from '../bridge/types';

type Engine = 'web' | 'native' | 'none';

const hasWebSpeech =
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof SpeechSynthesisUtterance !== 'undefined';

let engine: Engine = hasWebSpeech ? 'web' : 'none';
let engineReady: Promise<void> | null = null;

// Belt-and-suspenders: if the whole WebView is torn down (user leaves the
// service), stop any in-flight speech. Native dispose is the reliable path;
// this covers cases where the page is hidden but the bridge still exists.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    try {
      postNative('tts_stop', null);
    } catch {
      // Best effort only.
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Best effort only.
      }
    }
  });
}

function ensureEngine(): Promise<void> {
  if (engineReady) return engineReady;
  engineReady = (async () => {
    if (engine === 'none' && isInApp()) {
      try {
        const r = await callNative<TtsCheckResult>('tts_check', null, 4000);
        if (r && r.available === true) engine = 'native';
      } catch {
        // Old App without TTS handlers: stay on 'none'.
      }
    }
  })();
  return engineReady;
}

function pickZhVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === 'zh-tw') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ??
    null
  );
}

export function useTts() {
  const supported = ref(true);
  const taigiSupported = ref(true);

  /**
   * Speak precomputed Taigi phonemes via the native VITS engine.
   * Polls taigi_check while the model is still loading (up to ~60s);
   * returns false only on definitive failure so the caller can fall back.
   */
  async function speakTaigi(phonemes: string, onWaiting?: () => void): Promise<boolean> {
    const p = phonemes.trim();
    if (!p) return false;
    if (!isInApp()) {
      taigiSupported.value = false;
      return false;
    }
    const deadline = Date.now() + 60000;
    let notified = false;
    for (;;) {
      let r: { available?: boolean; status?: string } | null = null;
      try {
        r = await callNative<{ available?: boolean; status?: string }>('taigi_check', null, 8000);
        console.log('[taigi] check:', JSON.stringify(r));
      } catch (e) {
        console.log('[taigi] check threw:', e instanceof Error ? e.message : e);
        return false;
      }
      if (r && r.available === true) break;
      if (!r || r.status === 'unavailable') {
        taigiSupported.value = false;
        return false;
      }
      // status idle|loading: model still warming up.
      if (!notified) {
        notified = true;
        onWaiting?.();
      }
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    try {
      console.log('[taigi] speak sending', p.length, 'chars');
      const res = await callNative<TtsSpeakResult>('taigi_speak', { phonemes: p }, 10 * 60 * 1000);
      console.log('[taigi] speak result:', JSON.stringify(res));
      return res === 'done' || res === 'stopped';
    } catch (e) {
      // Speech was interrupted or failed; caller falls back to Mandarin.
      console.log('[taigi] speak threw:', e instanceof Error ? e.message : e);
      return false;
    }
  }

  async function speak(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    await ensureEngine();
    if (engine === 'native') {
      try {
        await callNative<TtsSpeakResult>('tts_speak', { text: trimmed }, 10 * 60 * 1000);
      } catch {
        // Speech was interrupted or failed; safe to ignore.
      }
      return;
    }
    if (engine === 'web') {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.lang = 'zh-TW';
      utter.rate = 0.9;
      const voice = pickZhVoice();
      if (voice) utter.voice = voice;
      window.speechSynthesis.speak(utter);
      return;
    }
    supported.value = false;
  }

  function stop(): void {
    postNative('taigi_stop', null);
    if (engine === 'native') {
      postNative('tts_stop', null);
    } else if (engine === 'web' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  return { speak, speakTaigi, stop, supported, taigiSupported, isInApp };
}
