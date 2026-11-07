<template>
  <footer class="pager" role="navigation" aria-label="換頁">
    <button
      type="button"
      class="page-btn"
      :disabled="page <= 0"
      aria-label="上一頁"
      @click="emit('prev')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
    </button>
    <button
      type="button"
      class="page-btn"
      :disabled="page >= totalPages - 1"
      aria-label="下一頁"
      @click="emit('next')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
    </button>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  page: number;
  totalPages: number;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
}>();
</script>

<style scoped>
.pager {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 10px 20px calc(10px + env(safe-area-inset-bottom));
  background: var(--white);
  border-top: 1px solid var(--gray-200);
  flex: none;
}

.page-btn {
  height: 56px;
  border: none;
  border-radius: var(--radius-btn);
  background: linear-gradient(135deg, #73c8d5, #3eb7c8);
  color: var(--white);
  display: grid;
  place-items: center;
}

.page-btn svg {
  width: 28px;
  height: 28px;
}

.page-btn:disabled {
  background: var(--gray-100);
  color: #9aa4a8;
}

.page-btn:not(:disabled):active {
  opacity: 0.8;
}
</style>
