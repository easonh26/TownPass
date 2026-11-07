// Distance formatting shared by list rows, detail pages and voice scripts.

export function formatDistance(meters: number | null): string {
  if (meters === null || Number.isNaN(meters)) return '距離未知';
  const m = Math.max(0, Math.round(meters));
  if (m < 1000) return `${m}公尺`;
  return `${(m / 1000).toFixed(1)}公里`;
}

export function formatRadius(meters: number): string {
  if (meters < 1000) return `方圓${Math.round(meters)}公尺內`;
  return `方圓${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)}公里內`;
}
