#!/usr/bin/env python3
"""Build venues_taigi.db from venues.db.

Copies the source DB untouched, adds name_phonemes / discount_phonemes
columns (pygoruut MinnanHokkien2 phoneme strings, NFD-normalized), and a
build_info table for traceability.

Validated pipeline (2026-11-08, laptop ONNX trial):
  pygoruut 0.6.3 -> NFD -> g>ɡ, ʰ>ʜ, CJK punct>ASCII -> per-char token IDs
  (+BOS/EOS), scales [0.667, 0.667, 1.0] -> 22050 Hz mono wav.

Usage:
    ~/.venvs/taigi/bin/python senior-card/taigi/make_taigi_db.py
"""
import shutil
import sqlite3
import sys
import unicodedata
from datetime import datetime, timezone

SRC = "senior-card/api/data/venues.db"
DST = "senior-card/api/data/venues_taigi.db"
TOKENS = "onnx_out/tokens.txt"
PYGORUUT_VERSION = "0.6.3"

PUNCT = {
    "。": ".", "，": ",", "、": ",", "！": "!", "？": "?",
    "；": ";", "：": ":", "（": "(", "）": ")",
    "「": "'", "」": "'", "『": "'", "』": "'",
    "‘": "'", "’": "'", "“": "'", "”": "'",
    "—": "-", "–": "-", "·": "-", "…": "",
    "/": "和",
}

# Latin letters / abbreviations -> Han readings (Taiwanese letter names).
# Team: please verify/correct these.
LETTER_NAMES = {
    "AIT": "欸愛替",
    "OK": "歐開",
    "Km": "公里",
    "A": "欸", "B": "比", "C": "西", "D": "弟", "F": "艾甫",
    "K": "開", "O": "歐",
}

# OOV Han chars (pygoruut MinnanHokkien2 0.6.3 passes them through)
# -> replacement Han with the SAME Minnan reading (team: verify by listening).
# Display still uses the original DB text; replacements only feed the phonemizer.
OOV_REPLACE = {
    "奎": "龜", "硿": "空", "遼": "料", "憩": "汽", "磘": "搖",
    "乘": "承",
    "悠": "游",
    "邸": "抵",
    "嘴": "喙",
    "迪": "特",
    "舺": "甲",
    "艋": "網",
    "杭": "航",
    "鄒": "糟",
    "鷺": "路",
    "釦": "扣",
    "汴": "便",
    "亨": "興",
    "瑤": "搖",
    "牯": "鼓",
    "籟": "賴",
    "臥": "傲",
    "豫": "芋",
    "漾": "用",
    "馥": "福",
    "廖": "料",
    "悅": "越",
    "圭": "規",
    "蕃": "番",
    "崑": "昆",
    "鵬": "平",
    "吾": "吳",
    "暨": "記",
    "趟": "擋",
    "劉": "留",
    "霖": "林",
    "恆": "衡",
    "莎": "紗",
    "磐": "盤",
    "浦": "譜",
    "瑠": "留",
    "翔": "祥",
    "馨": "興",
    "薇": "眉",
    "陶": "桃",
    "桀": "傑",
    "圃": "譜",
    "砲": "炮",
    "堰": "印",
    "湊": "臭",
    "烤": "考",
    "蒸": "增",
    "們": "文",
    "丰": "風",
    "峒": "銅",
    "祐": "佑",
    "汀": "町",
    "澗": "幹",
    "帥": "歲",
    "舘": "館",
    "喬": "橋",
    "甫": "府",
    "禾": "和",
    "岐": "旗",
    "祉": "姊",
    "戍": "恕",
    "舟": "州",
    "晴": "情",
    "啤": "眉",
    "沂": "儀",
    "晉": "進",
    "昊": "號",
    "仲": "重",
    "菸": "煙",
    "范": "犯",
    "芬": "分",
    "穆": "牧",
    "坊": "風",
    "茵": "因",
    "樺": "華",
    "毅": "藝",
    "靶": "把",
    "臻": "真",
    "盧": "蘆",
    "錡": "旗",
    "濤": "桃",
    "泵": "棒",
    "瓏": "玲",
    "嵩": "松",
    "璦": "愛",
    "嶽": "岳",
    "怡": "姨",
    "妍": "研",
    "筠": "雲",
    "廨": "屆",
    "濂": "簾",
    "茹": "如",
    "耿": "景",
    "詹": "尖",
    "穹": "供",
    "芊": "千",
    "哨": "掃",
    "崧": "松",
    "櫸": "舉",
    "汛": "信",
    "緯": "偉",
    "鑫": "欣",
    "塘": "長",
    "陞": "升",
    "盃": "杯",
    "洪": "紅",
    "頌": "上",
    "翰": "漢",
    "泓": "紅",
    "夷": "姨",
    "椿": "村",
    "崛": "掘",
    "墅": "恕",
    "煤": "梅",
    "柏": "伯",
    "隧": "遂",
    "堤": "題",
    "偕": "皆",
    "巖": "嚴",
    "莒": "幾",
    "貞": "偵",
    "銘": "名",
    "滬": "護",
    "瀑": "曝",
    "御": "遇",
    "鴻": "紅",
    "俊": "峻",
    "擎": "瓊",
    "丘": "邱",
    "拱": "栱",
    "余": "于",
    "惇": "敦",
    "污": "熨",
    "窠": "苛",
    "側": "測",
    "埼": "崎",
    "稠": "酬",
    "璉": "臉",
    "擷": "傑",
    "錩": "昌",
    "旭": "蓄",
    "欽": "襟",
    "峨": "娥",
    "鱒": "尊",
    "嗎": "瑪",
    "芑": "杞",
    "札": "紮",
    "榭": "卸",
    "梘": "景",
}

COMBINING = dict.fromkeys(range(0x0300, 0x0370), "")

DIGITS = "零一二三四五六七八九"
UNITS = ["", "十", "百", "千"]
BIG = ["", "萬", "億"]


def _seg4(rem):
    """Four-digit group -> reading, e.g. 101 -> 一百空一, 20 -> 二十, 10 -> 十."""
    digits = [(rem // 1000) % 10, (rem // 100) % 10, (rem // 10) % 10, rem % 10]
    seg, prev_zero = "", False
    for pos, d in enumerate(digits):
        u = 3 - pos
        if d == 0:
            prev_zero = True
            continue
        if prev_zero and seg:
            seg += "空"
        if u == 1 and d == 1 and not seg:
            seg += "十"
        elif u == 0:
            seg += DIGITS[d]
        else:
            seg += DIGITS[d] + UNITS[u]
        prev_zero = False
    return seg


def place_value(n):
    if n == 0:
        return "空"
    groups, g = [], 0
    while n > 0:
        n, rem = divmod(n, 10000)
        if rem:
            groups.append((_seg4(rem), g))
        g += 1
    return "".join(seg + (BIG[g] if g else "") for seg, g in reversed(groups))


import re as _re

NUM_RE = _re.compile(r"\d[\d,]*")


def verbalize_numbers(text):
    """Replace Arabic numerals with Han readings.

    N點 (points) -> place value; 3+ digit route numbers -> digit-by-digit
    with 空 (150 -> 一五空); others -> place value.
    """

    def conv(m):
        raw, start, end = m.group(0), m.start(), m.end()
        n = int(raw.replace(",", ""))
        after = text[end : end + 1]
        if after == "點":
            return place_value(n)
        s = str(n)
        if len(s) >= 3:
            return "".join("空" if ch == "0" else DIGITS[int(ch)] for ch in s)
        return place_value(n)

    return NUM_RE.sub(conv, text)


def load_tokens(path):
    tok = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            s = line.rstrip("\n")
            sym, idx = s.rsplit(" ", 1)
            tok[sym] = int(idx)
    return tok


def normalize(phon):
    return unicodedata.normalize("NFD", phon).replace("g", "ɡ").replace("ʰ", "ʜ")


import re as _re2

LATIN_RE = _re2.compile(r"[A-Za-z]+")


def clean(text):
    text = unicodedata.normalize("NFKC", text)
    text = verbalize_numbers(text)

    def latin(m):
        w = m.group(0)
        return LETTER_NAMES.get(w, LETTER_NAMES.get(w.upper(), w))

    # longest match first (AIT/OK/Km before single letters)
    text = _re2.sub(r"AIT|OK|Km|[A-Za-z]", lambda m: latin(m), text)
    return "".join(PUNCT.get(c, c) for c in text)


def strip_combining(phon):
    return phon.translate(COMBINING)


def main():
    from pygoruut.pygoruut import Pygoruut

    import pygoruut
    ver = getattr(pygoruut, "__version__", "unknown")
    print(f"pygoruut package: {ver} (expected {PYGORUUT_VERSION})", flush=True)

    tok = load_tokens(TOKENS)
    print(f"tokens: {len(tok)}", flush=True)

    shutil.copyfile(SRC, DST)
    con = sqlite3.connect(DST)
    cur = con.cursor()
    cols = [r[1] for r in cur.execute("PRAGMA table_info(venues)").fetchall()]
    for col in ("name_phonemes", "discount_phonemes"):
        if col not in cols:
            cur.execute(f"ALTER TABLE venues ADD COLUMN {col} TEXT")

    import gc as _gc

    holder = {"p": Pygoruut()}
    cache = {}
    failures = []

    import json as _json2
    import os as _os

    cache_path = "/tmp/taigi_phon_cache.json"
    if _os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as cf:
            cache.update(_json2.load(cf))
        print(f"loaded disk cache: {len(cache)} texts", flush=True)

    def save_cache():
        with open(cache_path, "w", encoding="utf-8") as cf:
            _json2.dump(cache, cf, ensure_ascii=False)

    def phonemize(text):
        if text in cache:
            return cache[text]
        for ch, rep in OOV_REPLACE.items():
            text = text.replace(ch, rep)
        last_err = None
        for attempt in range(4):
            try:
                import re as _re3
                phon = _re3.sub(r"[0-9]", "", str(holder["p"].phonemize(language="MinnanHokkien2", sentence=clean(text))))
                break
            except Exception as e:  # server hiccup: respawn backend and retry
                last_err = e
                import time as _t

                _t.sleep(2 * (attempt + 1))
                try:
                    holder["p"] = Pygoruut()  # old instance GC'd -> __del__ kills old server
                    _gc.collect()
                except Exception as e2:
                    last_err = e2
        else:
            failures.append((text, f"<phonemize failed: {last_err}>", []))
            cache[text] = None
            return None
        norm = strip_combining(normalize(phon))
        unk = sorted(set(c for c in norm if c not in tok))
        if unk:
            failures.append((text, phon, unk))
            cache[text] = None
            return None
        cache[text] = norm
        return norm

    rows = cur.execute("SELECT id, name, discount_info FROM venues").fetchall()
    print(f"rows: {len(rows)}", flush=True)
    max_ids = 0
    for i, (vid, name, disc) in enumerate(rows):
        np = phonemize(name or "")
        dp = phonemize(disc or "")
        if np is not None:
            max_ids = max(max_ids, len(np))
        cur.execute(
            "UPDATE venues SET name_phonemes = ?, discount_phonemes = ? WHERE id = ?",
            (np, dp, vid),
        )
        if (i + 1) % 1000 == 0:
            con.commit()
            save_cache()
            print(f"  {i + 1}/{len(rows)} unique_texts={len(cache)} failures={len(failures)}", flush=True)
    con.commit()
    save_cache()

    import json as _json

    with open("/tmp/taigi_failures.jsonl", "w", encoding="utf-8") as fl:
        for text, phon, unk in failures:
            fl.write(_json.dumps({"text": text, "phon": phon, "unk": unk}, ensure_ascii=False) + "\n")
    print(f"failures logged: {len(failures)} -> /tmp/taigi_failures.jsonl", flush=True)

    cur.execute("DROP TABLE IF EXISTS build_info")
    cur.execute("CREATE TABLE build_info (key TEXT PRIMARY KEY, value TEXT)")
    cur.executemany(
        "INSERT INTO build_info VALUES (?, ?)",
        [
            ("built_at", datetime.now(timezone.utc).isoformat()),
            ("source_db", SRC),
            ("pygoruut_package", ver),
            ("pipeline", "NFD + g>ɡ + ʰ>ʜ + CJK punct>ASCII, per-char IDs, BOS=2 EOS=1"),
            ("failures", str(len(failures))),
        ],
    )
    con.commit()

    nulls = cur.execute(
        "SELECT COUNT(*) FROM venues WHERE name_phonemes IS NULL OR discount_phonemes IS NULL"
    ).fetchone()[0]
    print(f"done. null rows: {nulls}, max phoneme chars: {max_ids}", flush=True)
    for text, phon, unk in failures[:20]:
        print(f"FAIL text={text!r} phon={phon!r} unk={unk}", flush=True)
    con.close()
    if nulls:
        print("WARNING: some rows lack phonemes (see FAIL lines)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
