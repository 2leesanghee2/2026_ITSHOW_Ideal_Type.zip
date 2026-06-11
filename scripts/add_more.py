#!/usr/bin/env python3
"""
XDINARY HEROES(엑디즈) + 배우 (김재원, 유지태, 주지훈) 추가
"""

import json, re, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT        = Path(__file__).parent.parent
DATA_JS     = ROOT / "src" / "data.js"
CELEBS_JSON = Path(__file__).parent / "celebs.json"
REVIEW_JSON = ROOT / "public" / "celebs-data.json"

NEW_MEMBERS = [
    # ── XDINARY HEROES (엑디즈) ── 2021년 데뷔, JYP Entertainment ────────────
    # 락밴드: 구민·정수·가온·오경수(O.de)·박세진·나이
    {
        "name": "구민",   "emoji": "🎸", "group": "XDINARY HEROES",
        "mbti": "ISTP",  "score": 7800,
        "gender": "남",  "height": 175, "weight": 64, "age": 27,
        "nationality": "한국", "image": None
    },
    {
        "name": "정수",   "emoji": "🎸", "group": "XDINARY HEROES",
        "mbti": "INFP",  "score": 7500,
        "gender": "남",  "height": 178, "weight": 62, "age": 27,
        "nationality": "한국", "image": None
    },
    {
        "name": "가온",   "emoji": "🎸", "group": "XDINARY HEROES",
        "mbti": "ENFP",  "score": 7300,
        "gender": "남",  "height": 176, "weight": 61, "age": 26,
        "nationality": "한국", "image": None
    },
    {
        "name": "O.de",   "emoji": "🎸", "group": "XDINARY HEROES",
        "mbti": "ENTP",  "score": 7200,
        "gender": "남",  "height": 174, "weight": 60, "age": 25,
        "nationality": "한국", "image": None
    },
    {
        "name": "박세진", "emoji": "🎸", "group": "XDINARY HEROES",
        "mbti": "ISFJ",  "score": 7600,
        "gender": "남",  "height": 178, "weight": 63, "age": 24,
        "nationality": "한국", "image": None
    },
    {
        "name": "나이",   "emoji": "🎸", "group": "XDINARY HEROES",
        "mbti": "INFJ",  "score": 7400,
        "gender": "남",  "height": 176, "weight": 60, "age": 22,
        "nationality": "한국", "image": None
    },

    # ── 배우 ─────────────────────────────────────────────────────────────────
    {
        "name": "김재원", "emoji": "🎬", "group": "배우",
        "mbti": "INFJ",  "score": 8800,
        "gender": "남",  "height": 181, "weight": 73, "age": 45,
        "nationality": "한국", "image": None
    },
    {
        "name": "유지태", "emoji": "🎬", "group": "배우",
        "mbti": "INTJ",  "score": 8500,
        "gender": "남",  "height": 180, "weight": 72, "age": 50,
        "nationality": "한국", "image": None
    },
    {
        "name": "주지훈", "emoji": "🎬", "group": "배우",
        "mbti": "ENFP",  "score": 9100,
        "gender": "남",  "height": 182, "weight": 73, "age": 44,
        "nationality": "한국", "image": None
    },
]


def main():
    text = DATA_JS.read_text(encoding="utf-8")
    m    = re.search(r'export const CELEBRITIES\s*=\s*(\[[\s\S]*\])', text)
    if not m:
        sys.exit("❌ CELEBRITIES 배열을 찾을 수 없습니다.")
    data: list[dict] = json.loads(m.group(1))

    existing = {(c["name"], c["group"]) for c in data}
    max_id   = max(c["id"] for c in data)
    added    = 0

    for member in NEW_MEMBERS:
        key = (member["name"], member["group"])
        if key in existing:
            print(f"  ⏭  이미 존재: {member['name']} ({member['group']})")
            continue
        max_id += 1
        data.append({
            "id":          max_id,
            "name":        member["name"],
            "emoji":       member["emoji"],
            "group":       member["group"],
            "mbti":        member["mbti"],
            "score":       member["score"],
            "gender":      member["gender"],
            "height":      member["height"],
            "weight":      member["weight"],
            "age":         member["age"],
            "nationality": member["nationality"],
            "image":       member["image"],
        })
        print(f"  ✅ [{max_id}] {member['name']} ({member['group']})")
        existing.add(key)
        added += 1

    print(f"\n총 {added}명 추가 → 전체 {len(data)}명")

    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    DATA_JS.write_text(f"export const CELEBRITIES = {json_str}\n", encoding="utf-8")
    CELEBS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    REVIEW_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("💾 data.js / celebs.json / celebs-data.json 모두 저장 완료")

if __name__ == "__main__":
    main()
