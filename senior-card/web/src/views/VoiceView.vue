<template>
  <main class="screen">
    <section class="card" aria-labelledby="voice-title">
      <div class="icon-badge" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      </div>
      <h1 id="voice-title">語音朗讀</h1>
      <p>請選擇語音</p>

      <div class="choices choices-3" role="group" aria-label="請選擇語音">
        <button
          type="button"
          class="choice choice-yes"
          :aria-pressed="lang === 'mandarin'"
          @click="choose('mandarin')"
        >
          國語
        </button>
        <button
          type="button"
          class="choice choice-yes"
          :aria-pressed="lang === 'taigi'"
          @click="choose('taigi')"
        >
          台語
        </button>
        <button
          type="button"
          class="choice choice-no"
          :aria-pressed="lang === 'off'"
          @click="choose('off')"
        >
          否
        </button>
      </div>
    </section>

    <button type="button" class="balance-btn" @click="openBalance">
      <span class="lead" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="6" width="18" height="13" rx="3" />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      </span>
      <span class="label">查詢餘額</span>
      <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </button>

    <div class="status" role="status" aria-live="polite">{{ status }}</div>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { isInApp, postNative } from '../bridge/native';
import { ensureLocation } from '../locationState';
import { go, persistVoiceDefault, store, type VoiceLang } from '../store';
import { useVoice } from '../composables/useVoice';
import { askVoiceOn, voiceOnConfirmed } from '../voice/scripts';
import { askTaigi, confirmTaigi } from '../voice/taigi';

const BALANCE_URL = 'https://ezweb.easycard.com.tw/search/CardSearch.php';

const lang = ref<VoiceLang>('off');
const status = ref('');
const { say, speak, speakTaigi, stop, supported } = useVoice();

let alive = true;

async function choose(next: VoiceLang): Promise<void> {
  // Stop any in-flight auto-ask before starting the new utterance.
  stop();
  lang.value = next;
  store.voiceLang = next;
  store.voiceAsked = true;
  persistVoiceDefault(next);
  if (next === 'off') {
    stop();
    status.value = '已關閉語音朗讀';
  } else if (next === 'mandarin') {
    status.value = '已開啟語音朗讀';
    await say(voiceOnConfirmed(), null);
    if (!supported.value) status.value = '此裝置不支援語音朗讀';
  } else {
    // Only switch to Taigi after the engine proves ready.
    status.value = '台語語音準備中，請稍候…';
    const ok = await speakTaigi(confirmTaigi(), () => {
      status.value = '台語語音準備中，請稍候…';
    });
    if (ok) {
      lang.value = 'taigi';
      store.voiceLang = 'taigi';
      persistVoiceDefault('taigi');
      status.value = '台語語音已經開';
    } else {
      status.value = '台語語音未就緒，改用國語';
      await say(voiceOnConfirmed(), null);
      lang.value = 'mandarin';
      store.voiceLang = 'mandarin';
      persistVoiceDefault('mandarin');
    }
  }
  // Start locating in the background while the user moves on.
  void ensureLocation();
  go('categories');
}

function openBalance(): void {
  stop();
  if (isInApp()) {
    // System browser: the easycard page (captcha/JS) doesn't work in WebView.
    postNative('open_external', BALANCE_URL);
  } else {
    window.location.href = BALANCE_URL;
  }
}

onMounted(() => {
  alive = true;
  // Warm up the Taigi model in the background while the user decides.
  postNative('taigi_warmup', null);
  void (async () => {
    await speak(askVoiceOn());
    if (!alive) return;
    await speakTaigi(askTaigi());
  })();
});

onBeforeUnmount(() => {
  alive = false;
  stop();
});
</script>

<style scoped>
.screen {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  overflow: hidden;
}

.card {
  background: var(--white);
  border-radius: 10px;
  padding: 32px 20px 24px;
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
  min-height: 0;
}

.icon-badge {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--primary-50);
  display: grid;
  place-items: center;
  color: var(--primary-500);
  margin-bottom: 24px;
}

.card h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.card p {
  margin: 8px 0 0;
  font-size: 18px;
  color: var(--gray-700);
}

.choices {
  margin-top: auto;
  padding-top: 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  gap: 12px;
}

.choices-3 {
  grid-template-columns: 1fr 1fr 1fr;
}

.choices-3 .choice {
  font-size: 22px;
}

.choice {
  min-height: 64px;
  border-radius: 10px;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.choice-no {
  background: var(--white);
  color: var(--primary-700);
  border: 1.5px solid var(--primary-500);
}

.choice-yes {
  background: var(--primary-600);
  color: var(--white);
  border: 1.5px solid var(--primary-600);
}

.choice-no:active {
  background: var(--primary-50);
}

.choice-yes:active {
  background: var(--primary-700);
  border-color: var(--primary-700);
}

.balance-btn {
  min-height: 64px;
  border: none;
  border-radius: 10px;
  background: var(--white);
  box-shadow: var(--card-shadow);
  color: var(--gray-950);
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  text-align: left;
  width: 100%;
}

.balance-btn:active {
  background: var(--primary-50);
}

.balance-btn .lead {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-50);
  color: var(--primary-500);
  display: grid;
  place-items: center;
  flex: none;
}

.balance-btn .label {
  flex: 1;
}

.balance-btn .chev {
  color: var(--gray-700);
  flex: none;
}

.status {
  min-height: 24px;
  text-align: center;
  color: var(--primary-700);
  font-weight: 600;
}
</style>
