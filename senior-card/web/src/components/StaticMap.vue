<template>
  <div ref="el" class="static-map" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const props = defineProps<{
  lat: number;
  lng: number;
}>();

// Primary: NLSC Taiwan e-Map (open government data, no key required).
const NLSC_URL = 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}';
// Fallback: Esri World Street Map (already proven to load in WebView).
const ESRI_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

const el = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;

onMounted(() => {
  if (!el.value) return;
  map = L.map(el.value, {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
  }).setView([props.lat, props.lng], 16);

  const primary = L.tileLayer(NLSC_URL, {
    maxZoom: 19,
    attribution: '圖資 © 內政部國土測繪中心',
  });

  let errors = 0;
  let fallbackAdded = false;
  primary.on('tileerror', () => {
    errors += 1;
    if (errors >= 3 && !fallbackAdded && map) {
      fallbackAdded = true;
      map.removeLayer(primary);
      L.tileLayer(ESRI_URL, { maxZoom: 19, attribution: 'Tiles © Esri' }).addTo(map);
    }
  });
  primary.addTo(map);

  const pin = L.divIcon({
    className: 'senior-pin-wrap',
    html: '<div class="senior-pin"></div>',
    iconSize: [30, 42],
    iconAnchor: [15, 40],
  });
  L.marker([props.lat, props.lng], { icon: pin, interactive: false }).addTo(map);
});

onBeforeUnmount(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
.static-map {
  width: 100%;
  height: clamp(140px, 22dvh, 220px);
  border-radius: 13px;
  overflow: hidden;
  background: #e8eef0;
  flex: none;
  pointer-events: none;
}
</style>

<style>
/* Unscoped: rendered inside Leaflet panes by divIcon. */
.senior-pin {
  width: 30px;
  height: 30px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  background: #3eb7c8;
  border: 3px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
.leaflet-container {
  font-family: inherit;
}
.leaflet-control-attribution {
  font-size: 10px;
}
</style>
