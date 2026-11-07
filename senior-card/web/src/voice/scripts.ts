// Centralized voice scripts (all spoken Chinese in one place).
// Views call these helpers and pass the result to useTts().speak().
// List ordinals are global across pages (page 2 starts at 6);
// categories are fixed 1-4.
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

// --- P1b transport (1.公車、2.捷運、3.臺鐵、4.貓空纜車) ---
export function transportPrompt(): string {
  return '請選擇交通工具，有1.公車、2.捷運、3.臺鐵、4.貓空纜車四種。';
}

// --- P2 list (global ordinals; hint only on first announcement) ---
const HINT = '點選可看詳細資訊。';

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// Ordinals in speech use Chinese numerals (第一個…第十一個…).
function toChinese(n: number): string {
  if (n <= 10) return n === 10 ? '十' : CN_DIGITS[n]!;
  if (n < 20) return `十${CN_DIGITS[n - 10]!}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${CN_DIGITS[tens]!}十${ones === 0 ? '' : CN_DIGITS[ones]!}`;
}

function restNames(items: PlaceItem[], startOrdinal: number): string {
  return items
    .slice(1)
    .map((item, i) => `第${toChinese(startOrdinal + i + 1)}個，${item.name}。`)
    .join('');
}

function firstDetail(item: PlaceItem, ordinal: number, withHint: boolean): string {
  return (
    `第${toChinese(ordinal)}個是${item.name}，` +
    `距離${formatDistance(item.distanceMeters)}，扣${item.points}點。` +
    (withHint ? HINT : '')
  );
}

export function listSummary(total: number, category: string, items: PlaceItem[]): string {
  const first = items[0];
  if (!first) return listEmpty(category);
  return (
    `找到${total}個${category}場所。` +
    firstDetail(first, 1, true) +
    restNames(items, 1)
  );
}

export function listPageAnnouncement(
  page: number,
  items: PlaceItem[],
  pageSize = 5,
): string {
  const first = items[0];
  if (!first) return '';
  const ordinal = page * pageSize + 1;
  return `第${page + 1}頁。` + firstDetail(first, ordinal, false) + restNames(items, ordinal);
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
