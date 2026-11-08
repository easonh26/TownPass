// Taigi (Taiwanese Minnan) speech composer: builds phoneme strings for the
// native VITS engine from precomputed fragments (taigi.json, generated at
// build time by senior-card/taigi) plus per-venue phonemes from the API.
// Numbers are composed in Han then mapped per-character to phoneme fragments.
import FRAG from './taigi.json';
import HANFRAG from './han_frag.json';
import type { PlaceDetail, PlaceItem } from '../bridge/types';

const F = FRAG as Record<string, string>;
const H = HANFRAG as Record<string, string>;

const HAN_DIGITS = ['空', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function seg4(rem: number): string {
  const digits = [Math.floor(rem / 1000) % 10, Math.floor(rem / 100) % 10, Math.floor(rem / 10) % 10, rem % 10];
  const units = ['千', '百', '十', ''];
  let seg = '';
  let prevZero = false;
  digits.forEach((d, pos) => {
    const u = units[pos]!;
    if (d === 0) {
      prevZero = true;
      return;
    }
    if (prevZero && seg) seg += '空';
    if (u === '十' && d === 1 && !seg) {
      seg += '十';
    } else {
      seg += HAN_DIGITS[d]! + u;
    }
    prevZero = false;
  });
  return seg;
}

function intHan(n: number): string {
  n = Math.max(0, Math.round(n));
  if (n === 0) return '空';
  const groups: Array<[string, string]> = [];
  const big = ['', '萬'];
  let g = 0;
  while (n > 0) {
    const rem = n % 10000;
    if (rem > 0) groups.push([seg4(rem), big[g] ?? '']);
    n = Math.floor(n / 10000);
    g += 1;
  }
  return groups
    .reverse()
    .map(([s, b]) => s + b)
    .join('');
}

function hanToPhon(han: string): string {
  let out = '';
  for (const ch of han) {
    const p = H[ch];
    if (p) out += (out ? ' ' : '') + p;
  }
  return out;
}

/** Integer or one-decimal number -> Taigi phonemes (一千二百 / 一點二). */
export function numTaigi(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  const rounded1 = Math.round(n * 10) / 10;
  const intPart = Math.floor(rounded1);
  const frac = Math.round((rounded1 - intPart) * 10);
  let han = intHan(intPart);
  if (frac > 0) han += '點' + HAN_DIGITS[frac]!;
  return hanToPhon(han);
}

export function distTaigi(meters: number | null): string {
  if (meters === null || Number.isNaN(meters)) return `${F['dist']!} ${F['unknown']!}`;
  const m = Math.max(0, Math.round(meters));
  if (m < 1000) return `${F['dist']!} ${numTaigi(m)} ${F['m']!}`;
  const km = Math.round((m / 1000) * 10) / 10;
  return `${F['dist']!} ${numTaigi(km)} ${F['km']!}`;
}

const CAT_KEY: Record<string, string> = {
  '交通': 'c_transport', '娛樂': 'c_fun', '運動': 'c_sport', '醫療': 'c_medical',
  '公車': 't_bus', '捷運': 't_mrt', '臺鐵': 't_rail', '貓空纜車': 't_gondola',
};

export function labelTaigi(label: string): string {
  return F[CAT_KEY[label] ?? ''] ?? '';
}

export function askTaigi(): string {
  return F['ask']!;
}

export function confirmTaigi(): string {
  return F['confirm_taigi']!;
}

export function categoryPromptTaigi(): string {
  return F['cat_prompt']!;
}

export function transportPromptTaigi(): string {
  return F['trans_prompt']!;
}

function firstDetailTaigi(namePhon: string, ordinal: number, dist: number | null, points: number): string {
  return (
    `${F['ord']!} ${numTaigi(ordinal)} ${F['ge']!} ${F['is']!} ${namePhon},` +
    `${distTaigi(dist)},${F['deduct']!} ${numTaigi(points)} ${F['point']!}.`
  );
}

function restNamesTaigi(names: string[], startOrdinal: number): string {
  return names
    .slice(1)
    .map((namePhon, i) => `${F['ord']!} ${numTaigi(startOrdinal + i + 1)} ${F['ge']!},${namePhon}.`)
    .join('');
}

export function listSummaryTaigi(
  total: number,
  label: string,
  items: Array<{ namePhon: string; distanceMeters: number | null; points: number }>,
  pageSize = 5,
): string {
  const page = items.slice(0, pageSize);
  const first = page[0];
  if (!first) return F['load_fail']!;
  const names = page.map((x) => x.namePhon);
  return (
    `${F['found']!} ${numTaigi(total)} ${F['ge']!} ${labelTaigi(label)} ${F['place']!}.` +
    `${F['hint']!} ` +
    firstDetailTaigi(first.namePhon, 1, first.distanceMeters, first.points) +
    restNamesTaigi(names, 1)
  );
}

export function listPageAnnouncementTaigi(
  page: number,
  items: Array<{ namePhon: string; distanceMeters: number | null; points: number }>,
  pageSize = 5,
): string {
  const first = items[0];
  if (!first) return '';
  const ordinal = page * pageSize + 1;
  const names = items.map((x) => x.namePhon);
  return (
    `${F['ord']!} ${numTaigi(page + 1)} ${F['page']!}.` +
    firstDetailTaigi(first.namePhon, ordinal, first.distanceMeters, first.points) +
    restNamesTaigi(names, ordinal)
  );
}

export function listEmptyTaigi(label: string): string {
  return `${F['empty_head']!} ${labelTaigi(label)} ${F['empty_tail']!}`;
}

export function locationFailedTaigi(): string {
  return F['loc_fail']!;
}

export function loadFailedTaigi(): string {
  return F['load_fail']!;
}

export function detailSummaryTaigi(
  namePhon: string,
  benefitPhonemes: string[],
  page: number,
  distanceMeters: number | null,
  points: number,
): string {
  const lines = benefitPhonemes.map((b, i) => `${F['ord']!} ${numTaigi(page * 2 + i + 1)} ${F['item']!},${b}`);
  return (
    `${namePhon},${distTaigi(distanceMeters)},${F['deduct']!} ${numTaigi(points)} ${F['point']!}.` +
    lines.join('')
  );
}

export type TaigiListItem = Pick<PlaceItem, 'distanceMeters' | 'points'> & { namePhon: string };
export type TaigiDetail = Pick<PlaceDetail, 'distanceMeters' | 'points'> & {
  namePhon: string;
  benefitPhonemes: string[];
};
