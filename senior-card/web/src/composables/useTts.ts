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
    if (engine === 'native') {
      postNative('tts_stop', null);
    } else if (engine === 'web' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  return { speak, stop, supported, isInApp };
}
