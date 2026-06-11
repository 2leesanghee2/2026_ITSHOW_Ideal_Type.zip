#!/usr/bin/env python3
"""
celebs.json의 image URL을 public/images/celebs/에 직접 다운로드하고
image 필드를 로컬 경로로 업데이트합니다.
"""
import sys, re, json, io, time
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
except ImportError:
    sys.exit("pip install requests")

ROOT      = Path(__file__).parent.parent
CELEBS    = Path(__file__).parent / "celebs.json"
DATA_JS   = ROOT / "src" / "data.js"
IMG_DIR   = ROOT / "public" / "images" / "celebs"
IMG_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://kprofiles.com/",
    "Accept": "image/avif,image/webp,image/apng,*/*;q=0.8",
}

def img_ext(url):
    m = re.search(r"\.(\w{2,4})(?:\?|$)", url)
    return f".{m.group(1).lower()}" if m else ".jpg"

def download(url, path):
    try:
        r = requests.get(url, headers=HEADERS, timeout=20, stream=True)
        r.raise_for_status()
        if "image" not in r.headers.get("Content-Type", ""):
            return False
        with open(path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        return False

celebs = json.loads(CELEBS.read_text(encoding="utf-8"))
total = sum(1 for c in celebs if c.get("image") and c["image"].startswith("http"))
print(f"📸 다운로드 대상: {total}명")

ok = fail = skip = 0
for c in celebs:
    url = c.get("image", "")
    if not url or not url.startswith("http"):
        continue

    ext  = img_ext(url)
    slug = re.sub(r"[^\w가-힣]", "_", c["name"])
    fname = f"{c['id']:03d}_{slug}{ext}"
    path  = IMG_DIR / fname

    if path.exists():
        c["image"] = f"/images/celebs/{fname}"
        skip += 1
        continue

    if download(url, path):
        c["image"] = f"/images/celebs/{fname}"
        ok += 1
        print(f"  ✅ [{ok+skip}/{total}] {c['name']}")
    else:
        c["image"] = None
        fail += 1
        print(f"  ❌ {c['name']} ({url[:60]})")

    time.sleep(0.4)

# celebs.json 업데이트
CELEBS.write_text(json.dumps(celebs, ensure_ascii=False, indent=2), encoding="utf-8")

# data.js 업데이트
js = "export const CELEBRITIES = " + json.dumps(celebs, ensure_ascii=False, indent=2) + ";\n"
DATA_JS.write_text(js, encoding="utf-8")

print(f"\n✅ 완료: {ok}명 신규 / {skip}명 이미 있음 / {fail}명 실패")
print(f"📂 이미지 저장 위치: {IMG_DIR}")
