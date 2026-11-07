<template>
  <div class="page">
    <header class="topbar">
      <button type="button" class="nav-btn" aria-label="回場所列表" @click="backToList">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 5 8 12 15 19"></polyline></svg>
      </button>
      <h1>敬老卡優惠資訊</h1>
      <button type="button" class="nav-btn" aria-label="再播報一次" @click="replay">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
      </button>
    </header>

    <main class="content">
      <div v-if="state === 'loading'" class="center" role="status">
        <p class="loading-text">讀取中…</p>
      </div>

      <div v-else-if="state === 'error'" class="center" role="alert">
        <p class="error-title">讀取失敗</p>
        <p class="error-desc">{{ errorMessage }}</p>
        <button type="button" class="retry-btn" @click="reload">再試一次</button>
      </div>

      <template v-else-if="place">
        <section aria-label="店家位置">
          <h2 class="section-title">店家位置</h2>
          <div class="map-card">
            <StaticMap :lat="place.lat" :lng="place.lng" />
            <button type="button" class="map-hint" @click="openFullMap">
              點擊地圖查看完整位置 →
            </button>
            <p class="address"><span aria-hidden="true">📍</span><span>{{ place.address }}</span></p>
          </div>
        </section>

        <section class="store-card" :aria-label="place.name">
          <span class="store-tag">{{ place.subCategory }}</span>
          <span v-if="place.distanceMeters !== null" class="store-dist">
            {{ formatDistance(place.distanceMeters) }}
          </span>
          <h2 class="store-name">{{ place.name }}</h2>
          <p class="store-points">扣 {{ place.points }} 點</p>
        </section>

        <section class="detail-card" aria-label="優惠詳細說明">
          <h2 class="detail-title">優惠詳細說明（第 {{ textPage + 1 }}／{{ totalTextPages }} 頁）</h2>
          <ul class="benefit-list">
            <li v-for="(b, i) in textPageItems" :key="i">
              <span class="check" aria-hidden="true">✓</span><span>{{ b }}</span>
            </li>
          </ul>
          <p class="notice">※ 優惠內容、適用對象及使用條件，請依合作店家最新公告為準。</p>
        </section>
      </template>
    </main>

    <PagerFooter
      v-if="state === 'ready'"
      :page="textPage"
      :total-pages="totalTextPages"
      @prev="prevTextPage"
      @next="nextTextPage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import PagerFooter from '../components/PagerFooter.vue';
import StaticMap from '../components/StaticMap.vue';
import { apiErrorMessage, fetchPlace } from '../api/client';
import { isInApp, postNative } from '../bridge/native';
import { locationState } from '../locationState';
import { go, store } from '../store';
import { useTts } from '../composables/useTts';
import { formatDistance } from '../utils/format';
import type { PlaceDetail } from '../bridge/types';

const BENEFITS_PER_PAGE = 2;

type State = 'loading' | 'error' | 'ready';

const state = ref<State>('loading');
const errorMessage = ref('');
const place = ref<PlaceDetail | null>(null);
const textPage = ref(0);

const { speak, stop } = useTts();

const totalTextPages = computed(() =>
  Math.max(1, Math.ceil((place.value?.benefits.length ?? 0) / BENEFITS_PER_PAGE)),
);

const textPageItems = computed(() => {
  const all = place.value?.benefits ?? [];
  return all.slice(textPage.value * BENEFITS_PER_PAGE, textPage.value * BENEFITS_PER_PAGE + BENEFITS_PER_PAGE);
});

function backToList(): void {
  stop();
  go('list');
}

function replay(): void {
  stop();
  speakCurrentPage();
}

function openFullMap(): void {
  if (!place.value) return;
  const url =
    `https://www.openstreetmap.org/?mlat=${place.value.lat}&mlon=${place.value.lng}` +
    `#map=17/${place.value.lat}/${place.value.lng}`;
  if (isInApp()) {
    postNative('open_link', url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function prevTextPage(): void {
  if (textPage.value > 0) {
    stop();
    textPage.value -= 1;
    speakCurrentPage();
  }
}

function nextTextPage(): void {
  if (textPage.value < totalTextPages.value - 1) {
    stop();
    textPage.value += 1;
    speakCurrentPage();
  }
}

function speakCurrentPage(): void {
  const p = place.value;
  if (!store.voiceOn || !p) return;
  const lines = textPageItems.value.map((b, i) => `第${textPage.value * BENEFITS_PER_PAGE + i + 1}條，${b}`);
  void speak(`${p.name}，距離${formatDistance(p.distanceMeters)}，扣${p.points}點。${lines.join('')}`);
}

async function load(): Promise<void> {
  state.value = 'loading';
  if (!store.placeId) {
    go('list');
    return;
  }
  try {
    const pos = locationState.position;
    const detail = await fetchPlace(
      store.placeId,
      pos ? pos.latitude : null,
      pos ? pos.longitude : null,
    );
    place.value = detail;
    textPage.value = 0;
    state.value = 'ready';
    speakCurrentPage();
  } catch (e) {
    errorMessage.value = apiErrorMessage(e);
    state.value = 'error';
    if (store.voiceOn) void speak('讀取失敗，請再試一次。');
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
  padding: 8px;
  flex: none;
  box-shadow: 0 2px 8px rgba(62, 183, 200, 0.25);
}

.topbar h1 {
  margin: 0;
  flex: 1;
  text-align: center;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 1px;
}

.nav-btn {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 12px;
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
  width: 28px;
  height: 28px;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 14px;
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
}

.loading-text {
  font-size: 22px;
  font-weight: 600;
  color: var(--primary-700);
}

.error-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
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

.section-title {
  font-size: 19px;
  font-weight: 700;
  margin: 0 0 6px;
}

/* Fixed map card: never grows. */
.map-card {
  background: var(--white);
  border-radius: var(--radius-card);
  padding: 8px;
  box-shadow: var(--card-shadow);
  flex: none;
}

.map-hint {
  margin-top: 2px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--primary-500);
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  padding: 2px 0;
}

.address {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 0 0;
  font-size: 16px;
  line-height: 1.5;
}

.address span:last-child {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Fixed store card: name clamps to 2 lines. */
.store-card {
  background: var(--white);
  border-radius: 15px;
  padding: 10px 14px;
  box-shadow: var(--card-shadow);
  flex: none;
}

.store-tag {
  display: inline-block;
  background: #e6f7f9;
  color: var(--primary-700);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 15px;
  font-weight: 700;
}

.store-dist {
  float: right;
  font-size: 17px;
  font-weight: 600;
  line-height: 30px;
}

.store-name {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
  margin: 4px 0 0;
  clear: both;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.store-points {
  margin: 2px 0 0;
  color: var(--primary-600);
  font-size: 20px;
  font-weight: 700;
}

/* Flexible detail card: takes the remaining space, never pushes the footer. */
.detail-card {
  background: #eaf8fa;
  border-radius: 15px;
  padding: 10px 14px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 8px;
  flex: none;
}

.benefit-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: none;
}

.benefit-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 19px;
  line-height: 1.5;
}

.benefit-list li:last-child {
  margin-bottom: 0;
}

.benefit-list li span:last-child {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.check {
  color: var(--primary-500);
  font-size: 21px;
  font-weight: 700;
  flex-shrink: 0;
}

.notice {
  margin: 8px 0 0;
  padding: 8px 10px;
  background: #f0f1f1;
  border-radius: 10px;
  color: #5a5a5a;
  font-size: 14px;
  line-height: 1.5;
  flex: none;
}

/* Short screens: compress further, benefits stay 2 per page. */
@media (max-height: 760px) {
  .store-name {
    font-size: 22px;
  }
  .benefit-list li {
    font-size: 18px;
  }
  .benefit-list li span:last-child {
    -webkit-line-clamp: 2;
  }
}

@media (max-height: 640px) {
  .section-title {
    font-size: 18px;
  }
  .store-card {
    padding: 8px 12px;
  }
  .detail-card {
    padding: 8px 12px;
  }
  .detail-title {
    font-size: 18px;
  }
  .notice {
    font-size: 13px;
  }
}
</style>
