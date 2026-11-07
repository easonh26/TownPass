// Centralized voice scripts (all spoken Chinese in one place).
// Views call these helpers and pass the result to useTts().speak().
// Numbering restarts per page (1-5); categories are fixed 1-4.
import { formatDistance } from '../utils/format';
import type { PlaceDetail, PlaceItem } from '../bridge/types';

// --- P0 ---
export function askVoiceOn(): string {
  return '是否開啟語音朗讀？';
}

export function voiceOnConfirmed(): string {
  return '已開啟語音朗讀';
}

// --- P1 categories (1.交通、2.娛樂、3.運動、4.醫療) ---
export function categoryPrompt(): string {
  return '請選擇場所類別，有1.交通、2.娛樂、3.運動、4.醫療四種。';
}

// --- P2 list ---
function restNames(items: PlaceItem[], startIndex: number): string {
  return items
    .slice(1)
    .map((item, i) => `第${startIndex + i + 1}個，${item.name}。`)
    .join('');
}

function firstDetail(item: PlaceItem): string {
  return (
    `最近的是${item.name}，` +
    `距離${formatDistance(item.distanceMeters)}，扣${item.points}點。點選可看詳細資訊。`
  );
}

export function listSummary(total: number, category: string, items: PlaceItem[]): string {
  const first = items[0];
  if (!first) return listEmpty(category);
  return `找到${total}個${category}場所。` + firstDetail(first) + restNames(items, 1);
}

export function listPageAnnouncement(page: number, items: PlaceItem[]): string {
  const first = items[0];
  if (!first) return '';
  return `第${page + 1}頁。` + firstDetail(first) + restNames(items, 1);
}

export function listEmpty(category: string): string {
  return `附近沒有${category}類場所，請換個類別試試看。`;
}

export function locationFailed(): string {
  return '無法取得位置，請確認已開啟定位服務，再按一次再試一次。';
}

export function loadFailed(): string {
  return '讀取失敗，請再試一次。';
}

// --- P3 detail (2 benefits per page) ---
export function detailSummary(place: PlaceDetail, pageItems: string[], page: number): string {
  const lines = pageItems.map((b, i) => `第${page * 2 + i + 1}條，${b}`);
  return (
    `${place.name}，距離${formatDistance(place.distanceMeters)}，扣${place.points}點。` +
    lines.join('')
  );
}
