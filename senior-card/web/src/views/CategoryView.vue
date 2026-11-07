<template>
  <div class="page">
    <header class="topbar">
      <h1>地點分類</h1>
    </header>

    <main class="content">
      <div v-if="locationState.status === 'failed'" class="error-card" role="alert">
        <p class="error-title">無法取得位置</p>
        <p class="error-desc">請確認已開啟定位服務，再按一次按鈕重試。</p>
        <button type="button" class="retry-btn" @click="retry">再試一次</button>
      </div>

      <div v-else class="grid" role="group" aria-label="場所類別">
        <button
          v-for="c in categories"
          :key="c.name"
          type="button"
          class="category-btn"
          @click="pick(c.name)"
        >
          <span class="icon-circle" aria-hidden="true" v-html="c.icon"></span>
          <span class="category-name">{{ c.name }}</span>
        </button>
      </div>

      <p v-if="locationState.status === 'locating'" class="locating" role="status">
        定位中，請稍候…
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { ensureLocation, locationState, retryLocation } from '../locationState';
import { go, store } from '../store';
import { useTts } from '../composables/useTts';
import type { CategoryName } from '../bridge/types';

const categories: Array<{ name: CategoryName; icon: string }> = [
  {
    name: '交通',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>',
  },
  {
    name: '娛樂',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" /></svg>',
  },
  {
    name: '運動',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" /></svg>',
  },
  {
    name: '醫療',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5v4.5m0 0v4.5m0-4.5h4.5m-4.5 0H7.5" /></svg>',
  },
];

const { speak, stop } = useTts();

function pick(name: CategoryName): void {
  stop();
  store.category = name;
  store.listPage = 0;
  store.querySeq += 1;
  go('list');
}

function retry(): void {
  void retryLocation();
}

onMounted(() => {
  if (locationState.status === 'idle') void ensureLocation();
  if (store.voiceOn) {
    void speak('請選擇場所類別，有交通、娛樂、運動、醫療四種。');
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
  justify-content: center;
  padding: 14px 16px;
  flex: none;
  box-shadow: 0 2px 8px rgba(62, 183, 200, 0.25);
}

.topbar h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
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
