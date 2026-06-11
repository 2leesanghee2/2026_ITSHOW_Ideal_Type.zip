#!/usr/bin/env python3
"""
목록 검토 후 신규 추가:
  - BTS 뷔
  - IVE 안유진·장원영
  - 여자 배우/솔로 가수 13명
  - 남자 배우/솔로 가수 19명
  - 운동선수 15명
"""
import json, re, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT        = Path(__file__).parent.parent
DATA_JS     = ROOT / "src" / "data.js"
CELEBS_JSON = Path(__file__).parent / "celebs.json"
REVIEW_JSON = ROOT / "public" / "celebs-data.json"

NEW = [
    # ── BTS 누락 멤버 ───────────────────────────────────────────────────────
    {"name":"뷔",    "emoji":"🎤","group":"BTS",
     "mbti":"INFP","score":9500,"gender":"남","height":179,"weight":63,"age":31,"nationality":"한국","image":None},

    # ── IVE 누락 멤버 ──────────────────────────────────────────────────────
    {"name":"안유진","emoji":"👑","group":"IVE",
     "mbti":"ENFP","score":9200,"gender":"여","height":172,"weight":53,"age":23,"nationality":"한국","image":None},
    {"name":"장원영","emoji":"👑","group":"IVE",
     "mbti":"ESTP","score":9300,"gender":"여","height":173,"weight":50,"age":22,"nationality":"한국","image":None},

    # ── 여자 배우 ────────────────────────────────────────────────────────────
    {"name":"신민아","emoji":"🎬","group":"배우",
     "mbti":"ISFP","score":9500,"gender":"여","height":163,"weight":45,"age":42,"nationality":"한국","image":None},
    {"name":"전지현","emoji":"🎬","group":"배우",   # 배우 전지현 (Gianna Jun)
     "mbti":"ENTJ","score":9300,"gender":"여","height":173,"weight":48,"age":45,"nationality":"한국","image":None},
    {"name":"송혜교","emoji":"🎬","group":"배우",
     "mbti":"ISFJ","score":9100,"gender":"여","height":160,"weight":45,"age":45,"nationality":"한국","image":None},
    {"name":"김태희","emoji":"🎬","group":"배우",
     "mbti":"ISFP","score":9000,"gender":"여","height":162,"weight":45,"age":46,"nationality":"한국","image":None},
    {"name":"수지",  "emoji":"🎬","group":"배우",
     "mbti":"ENFP","score":9200,"gender":"여","height":168,"weight":50,"age":32,"nationality":"한국","image":None},
    {"name":"박보영","emoji":"🎬","group":"배우",
     "mbti":"ENFJ","score":9000,"gender":"여","height":163,"weight":47,"age":36,"nationality":"한국","image":None},
    {"name":"고윤정","emoji":"🎬","group":"배우",
     "mbti":"INFP","score":8800,"gender":"여","height":169,"weight":47,"age":30,"nationality":"한국","image":None},
    {"name":"김지원","emoji":"🎬","group":"배우",
     "mbti":"ISFJ","score":8900,"gender":"여","height":166,"weight":46,"age":34,"nationality":"한국","image":None},
    {"name":"김유정","emoji":"🎬","group":"배우",
     "mbti":"ENFP","score":8700,"gender":"여","height":163,"weight":45,"age":24,"nationality":"한국","image":None},
    {"name":"유다인","emoji":"🎬","group":"배우",
     "mbti":"INFJ","score":8200,"gender":"여","height":168,"weight":46,"age":38,"nationality":"한국","image":None},

    # ── 여자 솔로 가수 ────────────────────────────────────────────────────────
    {"name":"이하이","emoji":"🎵","group":"솔로",
     "mbti":"INFP","score":8300,"gender":"여","height":168,"weight":48,"age":30,"nationality":"한국","image":None},
    {"name":"이효리","emoji":"🎵","group":"솔로",
     "mbti":"ESFP","score":9000,"gender":"여","height":167,"weight":50,"age":47,"nationality":"한국","image":None},

    # ── Girl's Day 유라 ───────────────────────────────────────────────────────
    {"name":"유라",  "emoji":"🌼","group":"Girl's Day",
     "mbti":"ENFP","score":8500,"gender":"여","height":165,"weight":46,"age":34,"nationality":"한국","image":None},

    # ── 남자 배우 ────────────────────────────────────────────────────────────
    {"name":"박해일","emoji":"🎬","group":"배우",
     "mbti":"INTJ","score":9000,"gender":"남","height":178,"weight":68,"age":49,"nationality":"한국","image":None},
    {"name":"강동원","emoji":"🎬","group":"배우",
     "mbti":"INTJ","score":9300,"gender":"남","height":187,"weight":75,"age":45,"nationality":"한국","image":None},
    {"name":"박보검","emoji":"🎬","group":"배우",
     "mbti":"ENFJ","score":9100,"gender":"남","height":182,"weight":69,"age":33,"nationality":"한국","image":None},
    {"name":"송중기","emoji":"🎬","group":"배우",
     "mbti":"ENFP","score":9000,"gender":"남","height":178,"weight":67,"age":41,"nationality":"한국","image":None},
    {"name":"김우빈","emoji":"🎬","group":"배우",
     "mbti":"ISTP","score":8800,"gender":"남","height":187,"weight":75,"age":37,"nationality":"한국","image":None},
    {"name":"이종석","emoji":"🎬","group":"배우",
     "mbti":"INFP","score":8700,"gender":"남","height":185,"weight":68,"age":37,"nationality":"한국","image":None},
    {"name":"정우성","emoji":"🎬","group":"배우",
     "mbti":"INFJ","score":9200,"gender":"남","height":186,"weight":80,"age":53,"nationality":"한국","image":None},
    {"name":"이병헌","emoji":"🎬","group":"배우",
     "mbti":"INTJ","score":9000,"gender":"남","height":177,"weight":68,"age":56,"nationality":"한국","image":None},
    {"name":"류준열","emoji":"🎬","group":"배우",
     "mbti":"INFP","score":8500,"gender":"남","height":180,"weight":67,"age":40,"nationality":"한국","image":None},
    {"name":"김남길","emoji":"🎬","group":"배우",
     "mbti":"ISFP","score":8600,"gender":"남","height":181,"weight":73,"age":45,"nationality":"한국","image":None},
    {"name":"권상우","emoji":"🎬","group":"배우",
     "mbti":"ESFP","score":8400,"gender":"남","height":182,"weight":72,"age":50,"nationality":"한국","image":None},
    {"name":"정경호","emoji":"🎬","group":"배우",
     "mbti":"ENFP","score":8700,"gender":"남","height":181,"weight":71,"age":40,"nationality":"한국","image":None},
    {"name":"남주혁","emoji":"🎬","group":"배우",
     "mbti":"INFJ","score":8900,"gender":"남","height":183,"weight":68,"age":32,"nationality":"한국","image":None},
    {"name":"이준기","emoji":"🎬","group":"배우",
     "mbti":"ENFP","score":8600,"gender":"남","height":180,"weight":67,"age":44,"nationality":"한국","image":None},
    {"name":"강하늘","emoji":"🎬","group":"배우",
     "mbti":"ENFP","score":8700,"gender":"남","height":185,"weight":72,"age":36,"nationality":"한국","image":None},
    {"name":"유승호","emoji":"🎬","group":"배우",
     "mbti":"INFP","score":8400,"gender":"남","height":176,"weight":62,"age":33,"nationality":"한국","image":None},
    {"name":"김래원","emoji":"🎬","group":"배우",
     "mbti":"INFJ","score":8500,"gender":"남","height":182,"weight":70,"age":45,"nationality":"한국","image":None},

    # ── 남자 솔로 (가수→배우 겸업) ───────────────────────────────────────────
    {"name":"비",    "emoji":"🎵","group":"솔로",
     "mbti":"ESFP","score":8800,"gender":"남","height":184,"weight":75,"age":44,"nationality":"한국","image":None},
    {"name":"이승기","emoji":"🎵","group":"솔로",
     "mbti":"ENFJ","score":8700,"gender":"남","height":180,"weight":68,"age":39,"nationality":"한국","image":None},

    # ── 운동선수 ──────────────────────────────────────────────────────────────
    {"name":"손흥민","emoji":"⚽","group":"운동선수",
     "mbti":"ENFP","score":9800,"gender":"남","height":183,"weight":78,"age":34,"nationality":"한국","image":None},
    {"name":"이강인","emoji":"⚽","group":"운동선수",
     "mbti":"ENFP","score":9000,"gender":"남","height":175,"weight":70,"age":25,"nationality":"한국","image":None},
    {"name":"김민재","emoji":"⚽","group":"운동선수",
     "mbti":"ISTJ","score":8800,"gender":"남","height":190,"weight":89,"age":30,"nationality":"한국","image":None},
    {"name":"조규성","emoji":"⚽","group":"운동선수",
     "mbti":"ISFP","score":8500,"gender":"남","height":189,"weight":80,"age":27,"nationality":"한국","image":None},
    {"name":"박지성","emoji":"⚽","group":"운동선수",
     "mbti":"ISTJ","score":8800,"gender":"남","height":178,"weight":74,"age":45,"nationality":"한국","image":None},
    {"name":"우상혁","emoji":"🏃","group":"운동선수",
     "mbti":"ENFP","score":8800,"gender":"남","height":188,"weight":80,"age":30,"nationality":"한국","image":None},
    {"name":"이용대","emoji":"🏸","group":"운동선수",
     "mbti":"INTJ","score":8300,"gender":"남","height":183,"weight":72,"age":38,"nationality":"한국","image":None},
    {"name":"박태환","emoji":"🏊","group":"운동선수",
     "mbti":"ISTJ","score":8500,"gender":"남","height":183,"weight":76,"age":37,"nationality":"한국","image":None},
    {"name":"정현",  "emoji":"🎾","group":"운동선수",
     "mbti":"INFP","score":8200,"gender":"남","height":188,"weight":83,"age":31,"nationality":"한국","image":None},
    {"name":"김제덕","emoji":"🏹","group":"운동선수",
     "mbti":"ENFP","score":8300,"gender":"남","height":180,"weight":65,"age":22,"nationality":"한국","image":None},
    {"name":"김연아","emoji":"⛸️","group":"운동선수",
     "mbti":"ISTJ","score":9800,"gender":"여","height":164,"weight":47,"age":36,"nationality":"한국","image":None},
    {"name":"이상화","emoji":"⛸️","group":"운동선수",   # 빙속스케이팅
     "mbti":"ENFP","score":8500,"gender":"여","height":166,"weight":60,"age":37,"nationality":"한국","image":None},
    {"name":"김연경","emoji":"🏐","group":"운동선수",
     "mbti":"ENTJ","score":9000,"gender":"여","height":192,"weight":82,"age":38,"nationality":"한국","image":None},
    {"name":"안산",  "emoji":"🏹","group":"운동선수",
     "mbti":"INFP","score":8500,"gender":"여","height":162,"weight":55,"age":25,"nationality":"한국","image":None},
    {"name":"김길리","emoji":"🛷","group":"운동선수",   # 스켈레톤
     "mbti":"ENFP","score":8200,"gender":"여","height":167,"weight":65,"age":26,"nationality":"한국","image":None},
]


def main():
    text = DATA_JS.read_text(encoding="utf-8")
    m    = re.search(r'export const CELEBRITIES\s*=\s*(\[[\s\S]*\])', text)
    data: list[dict] = json.loads(m.group(1))

    existing = {(c["name"], c["group"]) for c in data}
    max_id   = max(c["id"] for c in data)
    added    = 0

    by_group: dict[str, list[str]] = {}
    for member in NEW:
        key = (member["name"], member["group"])
        if key in existing:
            print(f"  ⏭  이미 존재: {member['name']} ({member['group']})")
            continue
        max_id += 1
        data.append({"id": max_id, **member})
        by_group.setdefault(member["group"], []).append(member["name"])
        existing.add(key)
        added += 1

    print("\n── 그룹별 추가 결과 ─────────────────────────")
    for group, names in by_group.items():
        print(f"  {group} ({len(names)}명): {', '.join(names)}")
    print(f"\n✅ 총 {added}명 추가 → 전체 {len(data)}명")

    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    DATA_JS.write_text(f"export const CELEBRITIES = {json_str}\n", encoding="utf-8")
    CELEBS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    REVIEW_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("💾 data.js / celebs.json / celebs-data.json 저장 완료")


if __name__ == "__main__":
    main()
