<template>
  <div class="page">
    <header class="topbar">
      <button type="button" class="nav-btn" aria-label="回類別選擇" @click="backToCategories">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
      </button>
      <h1>{{ radiusTitle }}</h1>
      <span class="tag">{{ store.transport ?? store.category }}</span>
    </header>

    <main class="content">
      <div v-if="state === 'loading'" class="center" role="status">
        <p class="loading-text">搜尋附近場所中…</p>
      </div>

      <div v-else-if="state === 'location-failed'" class="center" role="alert">
        <p class="error-title">無法取得位置</p>
        <p class="error-desc">請確認已開啟定位服務，再按一次按鈕重試。</p>
        <button type="button" class="retry-btn" @click="reload">再試一次</button>
      </div>

      <div v-else-if="state === 'error'" class="center" role="alert">
        <p class="error-title">讀取失敗</p>
        <p class="error-desc">{{ errorMessage }}</p>
        <button type="button" class="retry-btn" @click="reload">再試一次</button>
      </div>

      <div v-else-if="state === 'empty'" class="center" role="status">
        <p class="error-title">附近沒有這類場所</p>
        <p class="error-desc">請換個類別試試看。</p>
        <button type="button" class="retry-btn" @click="backToCategories">回類別選擇</button>
      </div>

      <div v-else class="list" role="list">
        <button
          v-for="(item, idx) in pageItems"
          :key="item.id"
          type="button"
          class="row"
          role="listitem"
          @click="openDetail(item.id)"
        >
          <span class="row-num" aria-hidden="true">{{ store.listPage * PAGE_SIZE + idx + 1 }}</span>
          <span class="row-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>
          </span>
          <span class="row-main">
            <span class="row-name">{{ item.name }}</span>
            <span class="row-sub">{{ item.subCategory }}</span>
          </span>
          <span class="row-side">
            <span class="row-dist">{{ formatDistance(item.distanceMeters) }}</span>
            <span class="row-points">扣{{ item.points }}點</span>
          </span>
        </button>
      </div>
    </main>

    <PagerFooter
      v-if="state === 'ready'"
      :page="store.listPage"
      :total-pages="totalPages"
      @prev="prevPage"
      @next="nextPage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import PagerFooter from '../components/PagerFooter.vue';
import { apiErrorMessage, fetchPlaces } from '../api/client';
import { ensureLocation, locationState } from '../locationState';
import { go, store } from '../store';
import { useTts } from '../composables/useTts';
import { formatDistance, formatRadius } from '../utils/format';
import { listEmpty, listPageAnnouncement, listSummary, loadFailed, locationFailed } from '../voice/scripts';
import type { PlaceItem } from '../bridge/types';

type State = 'loading' | 'location-failed' | 'error' | 'empty' | 'ready';

const PAGE_SIZE = 5;

const state = ref<State>('loading');
const errorMessage = ref('');
const radiusMeters = ref(1000);
const items = ref<PlaceItem[]>([]);
const totalCount = ref(0);

const { speak, stop } = useTts();

const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)));

const pageItems = computed(() =>
  items.value.slice(store.listPage * PAGE_SIZE, store.listPage * PAGE_SIZE + PAGE_SIZE),
);

const radiusTitle = computed(() =>
  state.value === 'ready' || state.value === 'empty' ? formatRadius(radiusMeters.value) : '搜尋中',
);

function backToCategories(): void {
  stop();
  if (store.category === '交通' && store.transport) {
    go('transport');
    return;
  }
  go('categories');
}

// Display label for voice scripts: transport sub-type if chosen.
const listLabel = computed(() => store.transport ?? store.category ?? '');

function openDetail(id: string): void {
  stop();
  store.placeId = id;
  go('detail');
}

function prevPage(): void {
  if (store.listPage > 0) {
    stop();
    store.listPage -= 1;
    speakCurrentPage();
  }
}

function nextPage(): void {
  if (store.listPage < totalPages.value - 1) {
    stop();
    store.listPage += 1;
    speakCurrentPage();
  }
}

function speakCurrentPage(): void {
  if (!store.voiceOn || items.value.length === 0) return;
  const text = listPageAnnouncement(store.listPage, pageItems.value, PAGE_SIZE);
  if (!text) return;
  void speak(text);
}

async function load(): Promise<void> {
  state.value = 'loading';
  if (!store.category) {
    go('categories');
    return;
  }
  const ok = await ensureLocation();
  if (!ok || !locationState.position) {
    state.value = 'location-failed';
    if (store.voiceOn) void speak(locationFailed());
    return;
  }
  try {
    const res = await fetchPlaces(
      store.category,
      locationState.position.latitude,
      locationState.position.longitude,
      20,
      store.category === '交通' ? store.transport : null,
    );
    radiusMeters.value = res.radiusMeters;
    items.value = res.items;
    totalCount.value = res.items.length;
    if (res.items.length === 0) {
      state.value = 'empty';
      if (store.voiceOn) void speak(listEmpty(listLabel.value));
      return;
    }
    state.value = 'ready';
    if (store.voiceOn) {
      void speak(listSummary(totalCount.value, listLabel.value, res.items));
    }
  } catch (e) {
    errorMessage.value = apiErrorMessage(e);
    state.value = 'error';
    if (store.voiceOn) void speak(loadFailed());
  }
}

function reload(): void {
  stop();
  void load();
}

onMounted(() => {
  void load();
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
  font-size: 19px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-btn {
  width: 44px;
  height: 44px;
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

.tag {
  background: var(--white);
  color: var(--primary-500);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  flex: none;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  min-height: 0;
  overflow: hidden;
}

.center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}

.loading-text {
  font-size: 22px;
  font-weight: 600;
  color: var(--primary-700);
}

.error-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.error-desc {
  color: var(--gray-700);
  margin: 0 0 16px;
}

.retry-btn {
  min-height: 64px;
  min-width: 240px;
  border: none;
  border-radius: var(--radius-btn);
  background: var(--primary-600);
  color: var(--white);
  font-size: 22px;
  font-weight: 700;
  padding: 0 32px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  flex: 1;
}

.row {
  background: var(--white);
  border: 1px solid var(--gray-100);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: left;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.row:active {
  background: var(--primary-50);
}

.row-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-500);
  color: var(--white);
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 700;
  flex: none;
}

.row-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary-100);
  color: var(--primary-500);
  display: grid;
  place-items: center;
  flex: none;
}

.row-icon svg {
  width: 22px;
  height: 22px;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-name {
  font-weight: 700;
  font-size: 19px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.row-sub {
  display: inline-block;
  align-self: flex-start;
  background: #e6f7f9;
  color: var(--primary-700);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 14px;
  font-weight: 700;
}

.row-side {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.row-dist {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.row-points {
  color: var(--primary-500);
  font-weight: 700;
  font-size: 18px;
  white-space: nowrap;
}
</style>
