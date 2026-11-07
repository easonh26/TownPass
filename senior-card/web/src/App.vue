<template>
  <VoiceView v-if="store.view === 'voice'" />
  <CategoryView v-else-if="store.view === 'categories'" />
  <ResultListView
    v-else-if="store.view === 'list'"
    :key="`list-${store.category}-${store.querySeq}`"
  />
  <DetailView v-else :key="`detail-${store.placeId ?? 'none'}`" />
</template>

<script setup lang="ts">
import VoiceView from './views/VoiceView.vue';
import CategoryView from './views/CategoryView.vue';
import ResultListView from './views/ResultListView.vue';
import DetailView from './views/DetailView.vue';
import { store } from './store';
</script>

<style>
/* Global shell: centered phone-width column. */
#app {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  background: var(--gray-50);
}
</style>
