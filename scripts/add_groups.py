#!/usr/bin/env python3
"""
ILLIT(아일릿) + WANNA ONE(워너원) 멤버를 data.js에 추가하고
celebs-data.json(검수 툴용) 및 celebs.json(Supabase 재임포트용)을 갱신합니다.
"""

import json, re, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT        = Path(__file__).parent.parent
DATA_JS     = ROOT / "src" / "data.js"
CELEBS_JSON = Path(__file__).parent / "celebs.json"
REVIEW_JSON = ROOT / "public" / "celebs-data.json"

# ── 추가할 멤버 데이터 ────────────────────────────────────────────────────────
# 이미지는 추후 scrape.py --group-only 또는 수동으로 추가
NEW_MEMBERS = [
    # ── ILLIT (아일릿) ── 2024년 데뷔, HYBE/Belift Lab ─────────────────────
    # members: 윤아·민주·모아(일본)·메리·원희
    {
        "name": "윤아", "emoji": "🌼", "group": "ILLIT",
        "mbti": "INFJ", "score": 8200,
        "gender": "여", "height": 165, "weight": 46, "age": 20,
        "nationality": "한국", "image": None
    },
    {
        "name": "민주", "emoji": "🌼", "group": "ILLIT",
        "mbti": "ENFP", "score": 7800,
        "gender": "여", "height": 162, "weight": 45, "age": 21,
        "nationality": "한국", "image": None
    },
    {
        "name": "모아", "emoji": "🌼", "group": "ILLIT",
        "mbti": "ISFP", "score": 7500,
        "gender": "여", "height": 161, "weight": 44, "age": 21,
        "nationality": "해외",  # 일본 출신
        "image": None
    },
    {
        "name": "메리", "emoji": "🌼", "group": "ILLIT",
        "mbti": "ESFP", "score": 7200,
        "gender": "여", "height": 165, "weight": 47, "age": 19,
        "nationality": "한국", "image": None
    },
    {
        "name": "원희", "emoji": "🌼", "group": "ILLIT",
        "mbti": "INFP", "score": 8500,
        "gender": "여", "height": 159, "weight": 44, "age": 19,
        "nationality": "한국", "image": None
    },

    # ── WANNA ONE (워너원) ── 2017-2019, Swing Entertainment ────────────────
    # 11명: 강다니엘·박지훈·이대휘·김재환·옹성우·박우진·
    #       라이관린(대만)·윤지성·황민현·배진영·하성운
    {
        "name": "강다니엘", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "ENFP", "score": 9500,
        "gender": "남", "height": 180, "weight": 70, "age": 29,
        "nationality": "한국", "image": None
    },
    {
        "name": "박지훈", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "INFP", "score": 8700,
        "gender": "남", "height": 172, "weight": 62, "age": 27,
        "nationality": "한국", "image": None
    },
    {
        "name": "이대휘", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "ENTP", "score": 8000,
        "gender": "남", "height": 175, "weight": 62, "age": 25,
        "nationality": "한국", "image": None
    },
    {
        "name": "김재환", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "ISFJ", "score": 8300,
        "gender": "남", "height": 180, "weight": 65, "age": 29,
        "nationality": "한국", "image": None
    },
    {
        "name": "옹성우", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "ENFP", "score": 8100,
        "gender": "남", "height": 181, "weight": 67, "age": 30,
        "nationality": "한국", "image": None
    },
    {
        "name": "박우진", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "ISTP", "score": 7800,
        "gender": "남", "height": 176, "weight": 62, "age": 27,
        "nationality": "한국", "image": None
    },
    {
        "name": "라이관린", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "INFP", "score": 7600,
        "gender": "남", "height": 182, "weight": 63, "age": 24,
        "nationality": "해외",  # 대만 출신
        "image": None
    },
    {
        "name": "윤지성", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "ENFJ", "score": 7900,
        "gender": "남", "height": 175, "weight": 69, "age": 34,
        "nationality": "한국", "image": None
    },
    {
        "name": "황민현", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "ISTJ", "score": 8400,
        "gender": "남", "height": 182, "weight": 63, "age": 30,
        "nationality": "한국", "image": None
    },
    {
        "name": "배진영", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "INFP", "score": 7700,
        "gender": "남", "height": 175, "weight": 60, "age": 26,
        "nationality": "한국", "image": None
    },
    {
        "name": "하성운", "emoji": "⭐", "group": "WANNA ONE",
        "mbti": "ENFJ", "score": 8000,
        "gender": "남", "height": 175, "weight": 64, "age": 33,
        "nationality": "한국", "image": None
    },
]


def main():
    # 1. 기존 data.js 읽기
    text = DATA_JS.read_text(encoding="utf-8")
    m    = re.search(r'export const CELEBRITIES\s*=\s*(\[[\s\S]*\])', text)
    if not m:
        sys.exit("❌ data.js에서 CELEBRITIES를 찾을 수 없습니다.")
    data: list[dict] = json.loads(m.group(1))

    existing_names = {(c["name"], c["group"]) for c in data}
    max_id = max(c["id"] for c in data)

    added = 0
    for member in NEW_MEMBERS:
        key = (member["name"], member["group"])
        if key in existing_names:
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
        print(f"  ✅ 추가: [{max_id}] {member['name']} ({member['group']})")
        existing_names.add(key)
        added += 1

    print(f"\n총 {added}명 추가 → 전체 {len(data)}명")

    # 2. data.js 저장
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    DATA_JS.write_text(f"export const CELEBRITIES = {json_str}\n", encoding="utf-8")
    print(f"💾 data.js 업데이트 완료")

    # 3. celebs.json (Supabase 재임포트용)
    CELEBS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"💾 celebs.json 업데이트 완료")

    # 4. celebs-data.json (검수 툴용)
    REVIEW_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"💾 celebs-data.json 업데이트 완료")

    print(f"""
📌 다음 단계:
   1) 이미지 크롤링:
      python scrape.py  (scrape.py GROUPS 목록에 ILLIT·WANNA ONE 추가 필요)

   2) Supabase 재임포트 (이미지 추가 후):
      python sb_import.py --url <URL> --key <KEY> --reset
""")


if __name__ == "__main__":
    main()
