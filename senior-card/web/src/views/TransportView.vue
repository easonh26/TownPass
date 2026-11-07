<template>
  <div class="page">
    <header class="topbar">
      <button type="button" class="nav-btn" aria-label="回場所分類" @click="backToCategories">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
      </button>
      <h1>交通工具</h1>
      <span class="topbar-spacer" aria-hidden="true"></span>
    </header>

    <main class="content">
      <div v-if="locationState.status === 'failed'" class="error-card" role="alert">
        <p class="error-title">無法取得位置</p>
        <p class="error-desc">請確認已開啟定位服務，再按一次按鈕重試。</p>
        <button type="button" class="retry-btn" @click="retry">再試一次</button>
      </div>

      <template v-else>
        <button
          type="button"
          class="voice-toggle"
          :class="{ on: store.voiceOn }"
          :aria-pressed="store.voiceOn"
          aria-label="語音朗讀開關"
          @click="toggleVoice"
        >
          <span class="toggle-icon" aria-hidden="true" v-html="store.voiceOn ? iconVoiceOn : iconVoiceOff"></span>
          <span class="toggle-label">語音朗讀：{{ store.voiceOn ? '開' : '關' }}</span>
        </button>

        <div class="grid" role="group" aria-label="交通工具">
          <button
            v-for="(t, i) in transports"
            :key="t.name"
            type="button"
            class="category-btn"
            @click="pick(t.name)"
          >
          <span class="icon-circle" aria-hidden="true" v-html="t.icon"></span>
          <span class="category-name" :class="{ 'name-long': t.name.length > 3 }">{{ i + 1 }}.{{ t.name }}</span>
          </button>
        </div>
      </template>

      <p v-if="locationState.status === 'locating'" class="locating" role="status">
        定位中，請稍候…
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { ensureLocation, locationState, retryLocation } from '../locationState';
import { go, persistVoiceDefault, store, type TransportName } from '../store';
import { useTts } from '../composables/useTts';
import { transportPrompt, voiceOnConfirmed } from '../voice/scripts';

// Side-view bus: long body, beltline, two wheels.
const BUS_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /><path stroke-linecap="round" d="M3 10.5h18" /><circle cx="7.5" cy="17.5" r="1.6" /><circle cx="16.5" cy="17.5" r="1.6" /></svg>';

// Front-view metro: rounded body, windshield, pantograph.
const MRT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12a2 2 0 0 1 2 2v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9a2 2 0 0 1 2-2z" /><path stroke-linecap="round" stroke-linejoin="round" d="M8 13.5V10h8v3.5" /><path stroke-linecap="round" d="M12 10v3.5" /><path stroke-linecap="round" d="M9 7V4M15 7V4M9 4h6" /></svg>';

// Rail engine: cab, chimney, rails with sleepers below.
const RAIL_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10a1 1 0 0 1 1 1v5H6V9a1 1 0 0 1 1-1z" /><path stroke-linecap="round" d="M12 8V4.5M10.5 4.5h3" /><path stroke-linecap="round" d="M9 11.5h6" /><path stroke-linecap="round" d="M4 17.5h16" /><path stroke-linecap="round" d="M7 17.5V20M12 17.5V20M17 17.5V20" /></svg>';

// Gondola: diagonal cable, hanger, suspended cabin.
const GONDOLA_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" d="M3 4.5 21 10.5" /><circle cx="12" cy="7.5" r="1" /><path stroke-linecap="round" d="M12 8.5V11" /><path stroke-linecap="round" stroke-linejoin="round" d="M8.5 11h7a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" /><path stroke-linecap="round" d="M7.5 15h9" /></svg>';

const transports: Array<{ name: TransportName; icon: string }> = [
  { name: '公車', icon: BUS_ICON },
  { name: '捷運', icon: MRT_ICON },
  { name: '臺鐵', icon: RAIL_ICON },
  { name: '貓空纜車', icon: GONDOLA_ICON },
];

const iconVoiceOn =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6 9H3v6h3l5 4V5z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15.5 8.5a5 5 0 0 1 0 7" /><path stroke-linecap="round" stroke-linejoin="round" d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>';
const iconVoiceOff =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6 9H3v6h3l5 4V5z" /><path stroke-linecap="round" stroke-linejoin="round" d="m22 9-6 6M16 9l6 6" /></svg>';

const { speak, stop } = useTts();

function pick(name: TransportName): void {
  stop();
  store.category = '交通';
  store.transport = name;
  store.listPage = 0;
  store.querySeq += 1;
  go('list');
}

function retry(): void {
  void retryLocation();
}

function backToCategories(): void {
  stop();
  go('categories');
}

async function toggleVoice(): Promise<void> {
  const on = !store.voiceOn;
  store.voiceOn = on;
  persistVoiceDefault(on);
  if (!on) {
    stop();
    return;
  }
  await speak(`${voiceOnConfirmed()}。${transportPrompt()}`);
}

onMounted(() => {
  if (locationState.status === 'idle') void ensureLocation();
  if (store.voiceOn) {
    void speak(transportPrompt());
  }
});

onBeforeUnmount(() => {
  stop();
});
</script>

<style scoped>
.page {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--gray-50);
  overflow: hidden;
}

.topbar {
  background: linear-gradient(135deg, #73c8d5, #3eb7c8);
  color: var(--white);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 12px;
  flex: none;
  box-shadow: 0 2px 8px rgba(62, 183, 200, 0.25);
}

.topbar h1 {
  margin: 0;
  flex: 1;
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
}

.nav-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--white);
  display: grid;
  place-items: center;
  flex: none;
}

.nav-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

.nav-btn svg {
  width: 26px;
  height: 26px;
}

.topbar-spacer {
  width: 48px;
  flex: none;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 24px;
  min-height: 0;
}

.voice-toggle {
  width: 100%;
  min-height: 56px;
  margin-bottom: 16px;
  border: 1.5px solid var(--primary-500);
  border-radius: 999px;
  background: var(--white);
  color: var(--primary-700);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  flex: none;
}

.voice-toggle.on {
  background: var(--primary-600);
  border-color: var(--primary-600);
  color: var(--white);
}

.voice-toggle:active {
  transform: scale(0.98);
}

.toggle-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: none;
}

.toggle-icon :deep(svg) {
  width: 28px;
  height: 28px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  width: 100%;
}

.category-btn {
  background: var(--white);
  border: 1px solid var(--gray-100);
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 32px 8px;
}

.category-btn:active {
  transform: scale(0.95);
  background: var(--primary-50);
}

.icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--primary-100);
  color: var(--primary-500);
  display: grid;
  place-items: center;
}

.icon-circle :deep(svg) {
  width: 32px;
  height: 32px;
}

.category-name {
  color: var(--gray-950);
  font-weight: 700;
  font-size: 28px;
  letter-spacing: 4px;
  margin-right: -4px;
}

.name-long {
  font-size: 26px;
}

.locating {
  margin-top: 16px;
  color: var(--primary-700);
  font-weight: 600;
}

.error-card {
  background: var(--white);
  border-radius: var(--radius-card);
  box-shadow: var(--card-shadow);
  padding: 32px 24px;
  text-align: center;
  width: 100%;
}

.error-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
}

.error-desc {
  color: var(--gray-700);
  margin: 0 0 24px;
}

.retry-btn {
  min-height: 64px;
  width: 100%;
  border: none;
  border-radius: var(--radius-btn);
  background: var(--primary-600);
  color: var(--white);
  font-size: 22px;
  font-weight: 700;
}
</style>
