#!/usr/bin/env python3
"""한글 파일명 → ID만 사용하는 ASCII 파일명으로 변경 + celebs.json/data.js/Supabase 업데이트"""
import sys, json, io, re
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT     = Path(__file__).parent.parent
CELEBS   = Path(__file__).parent / "celebs.json"
DATA_JS  = ROOT / "src" / "data.js"
IMG_DIR  = ROOT / "public" / "images" / "celebs"

celebs = json.loads(CELEBS.read_text(encoding="utf-8"))

renamed = 0
for c in celebs:
    old_img = c.get("image", "")
    if not old_img or not old_img.startswith("/images/celebs/"):
        continue

    old_fname = Path(old_img).name
    ext = Path(old_fname).suffix
    new_fname = f"{c['id']:03d}{ext}"
    new_img = f"/images/celebs/{new_fname}"

    if old_img == new_img:
        continue

    old_path = IMG_DIR / old_fname
    new_path = IMG_DIR / new_fname

    if old_path.exists() and not new_path.exists():
        old_path.rename(new_path)
        print(f"  {old_fname} → {new_fname}")
        renamed += 1
    elif new_path.exists():
        pass  # 이미 바뀐 것

    c["image"] = new_img

CELEBS.write_text(json.dumps(celebs, ensure_ascii=False, indent=2), encoding="utf-8")
DATA_JS.write_text(
    "export const CELEBRITIES = " + json.dumps(celebs, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8"
)
print(f"\n✅ {renamed}개 파일 이름 변경, celebs.json + data.js 업데이트 완료")
