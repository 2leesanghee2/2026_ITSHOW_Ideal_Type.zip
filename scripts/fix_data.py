#!/usr/bin/env python3
"""
data.js 데이터 정리 스크립트
- 해외 멤버 nationality 수정 (한국 → 해외)
- 이름 오류 수정
- 실제 존재하는 이미지 파일 기준으로 image 경로 검증/수정
- 수정된 data.js + celebs.json (Supabase 재임포트용) 출력
"""

import json, re, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT        = Path(__file__).parent.parent
DATA_JS     = ROOT / "src" / "data.js"
CELEBS_JSON = Path(__file__).parent / "celebs.json"
IMG_DIR     = ROOT / "public" / "images" / "celebs"

# ── 실제 존재하는 이미지 파일 목록 ───────────────────────────────────────────
EXISTING_IMGS = {f.name for f in IMG_DIR.iterdir()} if IMG_DIR.exists() else set()

# ── 해외 멤버 ID 목록 (국적을 "해외"로 바꿀 셀럽) ───────────────────────────
OVERSEAS_IDS = {
    # aespa
    4,   # 닝닝 (중국)
    # BLACKPINK
    8,   # 리사 (태국)
    # TWICE
    12,  # 모모 (일본)
    13,  # 사나 (일본)
    14,  # 미나 (일본)
    17,  # 쯔위 (대만)
    # LE SSERAFIM
    43,  # 사쿠라 (일본)
    45,  # 카즈하 (일본)
    # Kep1er
    76,  # 히카루 (일본)
    79,  # 마시로 (일본)
    # NewJeans
    23,  # 하니 (호주)
    26,  # Danielle (호주)
    # EXO
    201, # 레이 (중국)
    208, # 크리스 (캐나다/중국)
    209, # 루한 (중국)
    210, # 타오 (중국)
    # Stray Kids
    215, # Han (대만)
    216, # 필릭스 (호주)
    # ENHYPEN
    221, # 제이 (미국)
    222, # 제이크 (호주)
    225, # NiKi (일본)
    # SEVENTEEN
    234, # Jun (중국)
    # NCT 127
    247, # 유타 (일본)
    252, # 윈윈 (중국)
    # GOT7
    257, # 잭슨 (홍콩)
    260, # 뱀뱀 (태국)
    # 2PM
    268, # 닉쿤 (태국)
    # Super Junior
    319, # Hangeng (중국)
    # TREASURE
    370, # 아사히 (일본)
    372, # 요시 (일본)
    374, # 하루토 (일본)
    # NCT DREAM
    388, # 런쥔 (중국)
    # CLC
    189, # Sorn (태국)
}

# ── 이름 수정 ────────────────────────────────────────────────────────────────
NAME_FIXES = {
    273: "재범",   # "Jaebeom later known " → 재범 (2PM 멤버)
}

# ── 이미지 경로 수정 (확장자 오류 교정) ──────────────────────────────────────
EXT_CANDIDATES = [".jpeg", ".jpg", ".png", ".webp"]

def correct_image_path(image: str | None, celeb_id: int) -> str | None:
    """현재 경로의 파일이 존재하면 그대로, 없으면 다른 확장자로 시도, 그래도 없으면 None"""
    if image is None:
        return None

    filename = Path(image).name
    stem     = Path(filename).stem  # e.g. "001"

    # 현재 경로 파일이 존재하는지 확인
    if filename in EXISTING_IMGS:
        return image

    # 다른 확장자로 시도
    for ext in EXT_CANDIDATES:
        candidate = stem + ext
        if candidate in EXISTING_IMGS:
            print(f"  🔧 ID {celeb_id:>3}: {filename} → {candidate}")
            return f"/images/celebs/{candidate}"

    # 어떤 확장자도 없음 → null
    print(f"  ❌ ID {celeb_id:>3}: {filename} 이미지 없음 → null 처리")
    return None


def main():
    # 1. data.js 파싱
    text = DATA_JS.read_text(encoding="utf-8")
    m    = re.search(r'export const CELEBRITIES\s*=\s*(\[[\s\S]*\])', text)
    if not m:
        sys.exit("❌ data.js에서 CELEBRITIES 배열을 찾을 수 없습니다.")

    data: list[dict] = json.loads(m.group(1))
    print(f"📂 data.js 로드: {len(data)}명")

    # 2. 수정 적용
    fixed_nat  = 0
    fixed_name = 0
    fixed_img  = 0

    for c in data:
        cid = c["id"]

        # 국적 수정
        if cid in OVERSEAS_IDS and c.get("nationality") != "해외":
            c["nationality"] = "해외"
            fixed_nat += 1

        # 이름 수정
        if cid in NAME_FIXES and c["name"] != NAME_FIXES[cid]:
            old = c["name"]
            c["name"] = NAME_FIXES[cid]
            print(f"  ✏️  ID {cid}: 이름 '{old}' → '{c['name']}'")
            fixed_name += 1

        # 이미지 경로 검증/수정
        original = c.get("image")
        corrected = correct_image_path(original, cid)
        if corrected != original:
            c["image"] = corrected
            fixed_img += 1

    print(f"\n✅ 국적 수정: {fixed_nat}명 → '해외'")
    print(f"✅ 이름 수정: {fixed_name}건")
    print(f"✅ 이미지 경로 수정: {fixed_img}건")

    # 3. data.js 덮어쓰기
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    new_text = f"export const CELEBRITIES = {json_str}\n"
    DATA_JS.write_text(new_text, encoding="utf-8")
    print(f"\n💾 data.js 저장 완료: {DATA_JS}")

    # 4. celebs.json 생성 (Supabase 재임포트용)
    #    image 경로: null or "/images/celebs/XXX.ext" (로컬 경로 그대로)
    CELEBS_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"💾 celebs.json 저장 완료: {CELEBS_JSON}")
    print(f"\n🚀 Supabase 재임포트 명령:")
    print(f"   python sb_import.py --url <URL> --key <SERVICE_ROLE_KEY> --reset")


if __name__ == "__main__":
    main()
