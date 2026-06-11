#!/usr/bin/env python3
"""
image=null인 연예인의 이미지를 한국어/영어 위키피디아에서 가져옵니다.
사용법:
  pip install requests
  python get_missing_images.py
"""
import sys, re, json, io, time
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
except ImportError:
    sys.exit("pip install requests")

ROOT     = Path(__file__).parent.parent
DATA_JS  = ROOT / "src" / "data.js"
IMG_DIR  = ROOT / "public" / "images" / "celebs"
IMG_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; celebbot/1.0; +https://github.com/local)",
    "Accept": "application/json",
}
IMG_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://ko.wikipedia.org/",
}

# ── 위키 검색어 오버라이드 (자동 검색이 잘 안 되는 인물) ─────────────────────
NAME_OVERRIDE = {
    # 아이돌
    "하니":     ["하니 (가수)", "하니 뉴진스"],         # NewJeans
    "Haerin":   ["하린 (가수)", "김하린 뉴진스"],
    "Hyein":    ["이혜인 (가수)", "뉴진스 혜인"],
    "Danielle": ["대니얼 (가수)", "모 대니얼"],
    "Minji":    ["김민지 (가수)", "뉴진스 민지"],
    "윤아":     ["윤아 (아일릿)", "아일릿 윤아"],       # ILLIT (SNSD 윤아와 다름)
    "민주":     ["민주 (아일릿)"],
    "모아":     ["모아 (아일릿)"],
    "메리":     ["메리 (아일릿)"],
    "원희":     ["원희 (아일릿)"],
    "루한":     ["루한 (가수)"],
    "타오":     ["타오 (가수)", "황쯔타오"],
    "진진":     ["진진 (아이돌)"],
    "엠제이":   ["문빈&산하"],
    "차은우":   ["차은우"],
    "산하":     ["산하 (아이돌)"],
    "라키":     ["라키 (아이돌)"],
    # WANNA ONE
    "강다니엘": ["강다니엘"],
    "박지훈":   ["박지훈 (가수)"],
    "이대휘":   ["이대휘"],
    "김재환":   ["김재환 (가수)"],
    "옹성우":   ["옹성우"],
    "박우진":   ["박우진 (가수)"],
    "라이관린": ["라이관린"],
    "윤지성":   ["윤지성"],
    "황민현":   ["황민현"],
    "배진영":   ["배진영"],
    "하성운":   ["하성운"],
    # XDINARY HEROES
    "O.de":     ["오경수 (가수)", "O.de"],
    # 배우
    "유다인":   ["유다인 (배우)"],
    "김소은":   ["김소은 (배우)"],
    "조유리":   ["조유리 (배우)"],  # 아이돌 조유리와 다를 수 있음
    # 솔로 (중복 방지)
    "이하이":   ["이하이"],
    "이효리":   ["이효리"],
    "비":       ["비 (가수)"],
    "이승기":   ["이승기"],
    # 운동선수
    "김길리":   ["김길리"],
}

# ── 그룹별 영문 Wikipedia 시도용 ──────────────────────────────────────────────
EN_NAME = {
    "Haerin":   "Haerin",
    "Hyein":    "Hyein",
    "Danielle": "Danielle (singer)",
    "Minji":    "Minji (singer)",
    "O.de":     "O.de",
}

def wiki_image_ko(query: str) -> str | None:
    """한국어 위키피디아 REST summary API로 이미지 URL 획득"""
    url = f"https://ko.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(query)}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
        if r.status_code == 200:
            data = r.json()
            src = data.get("thumbnail", {}).get("source") or data.get("originalimage", {}).get("source")
            if src:
                # 고해상도로 올리기 (썸네일 크기 제한 제거)
                src = re.sub(r"/\d+px-", "/500px-", src)
                return src
    except Exception:
        pass
    return None

def wiki_search_ko(name: str) -> str | None:
    """위키피디아 검색 API → 첫 번째 결과로 이미지 재시도"""
    url = "https://ko.wikipedia.org/w/api.php"
    params = {
        "action": "query", "list": "search",
        "srsearch": name, "srlimit": 3,
        "format": "json", "utf8": 1,
    }
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=12)
        if r.ok:
            results = r.json().get("query", {}).get("search", [])
            for res in results:
                title = res["title"]
                img = wiki_image_ko(title)
                if img:
                    return img
    except Exception:
        pass
    return None

def wiki_image_en(query: str) -> str | None:
    """영어 위키피디아 fallback"""
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(query)}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
        if r.status_code == 200:
            src = r.json().get("thumbnail", {}).get("source")
            if src:
                src = re.sub(r"/\d+px-", "/500px-", src)
                return src
    except Exception:
        pass
    return None

def get_image_url(celeb: dict) -> str | None:
    name  = celeb["name"]
    group = celeb["group"]

    queries = NAME_OVERRIDE.get(name, [])

    # 기본 검색어: 이름 그대로
    if name not in queries:
        queries = [name] + queries

    # 그룹명 힌트 추가 (배우/솔로/운동선수는 직책 추가)
    if group == "배우":
        queries.append(f"{name} (배우)")
    elif group == "운동선수":
        queries.append(f"{name} (운동선수)")
    elif group == "솔로":
        queries.append(f"{name} (가수)")

    for q in queries:
        img = wiki_image_ko(q)
        if img:
            return img
        time.sleep(0.15)

    # 검색 API fallback
    img = wiki_search_ko(name)
    if img:
        return img

    # 영문 위키 fallback
    en_q = EN_NAME.get(name, name)
    img = wiki_image_en(en_q)
    return img

def img_ext(url: str) -> str:
    m = re.search(r"\.(\w{2,4})(?:[?#]|$)", url)
    return f".{m.group(1).lower()}" if m else ".jpg"

def download(url: str, path: Path) -> bool:
    try:
        r = requests.get(url, headers=IMG_HEADERS, timeout=20, stream=True)
        r.raise_for_status()
        ct = r.headers.get("Content-Type", "")
        if "image" not in ct and "octet" not in ct:
            return False
        with open(path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return path.stat().st_size > 3000  # 3KB 미만은 오류 이미지로 간주
    except Exception:
        return False

# ── 메인 ──────────────────────────────────────────────────────────────────────
text  = DATA_JS.read_text(encoding="utf-8")
m     = re.search(r"export const CELEBRITIES\s*=\s*(\[[\s\S]*?\])\s*\n", text)
data: list[dict] = json.loads(m.group(1))

targets = [c for c in data if not c.get("image")]
print(f"🔍 이미지 없는 연예인: {len(targets)}명\n")

ok = fail = skip = 0
for i, c in enumerate(targets, 1):
    cid   = c["id"]
    name  = c["name"]
    group = c["group"]

    # 이미 파일이 있는지 확인 (이전 실행 잔여물)
    existing = list(IMG_DIR.glob(f"{cid:03d}.*"))
    if existing:
        c["image"] = f"/images/celebs/{existing[0].name}"
        skip += 1
        print(f"  [{i}/{len(targets)}] ⏭  {name} ({group}) → 파일 있음")
        continue

    print(f"  [{i}/{len(targets)}] 🔎 {name} ({group}) ... ", end="", flush=True)
    img_url = get_image_url(c)

    if not img_url:
        print("❌ URL 없음")
        fail += 1
        time.sleep(0.3)
        continue

    ext  = img_ext(img_url)
    path = IMG_DIR / f"{cid:03d}{ext}"

    if download(img_url, path):
        c["image"] = f"/images/celebs/{path.name}"
        ok += 1
        print(f"✅ {path.name}")
    else:
        print(f"❌ 다운로드 실패 ({img_url[:60]})")
        fail += 1

    time.sleep(0.5)

# data.js 저장
json_str = json.dumps(data, ensure_ascii=False, indent=2)
DATA_JS.write_text(f"export const CELEBRITIES = {json_str}\n", encoding="utf-8")

print(f"\n{'─'*50}")
print(f"✅ 성공: {ok}명  ⏭ 이미 있음: {skip}명  ❌ 실패: {fail}명")
print(f"💾 data.js 저장 완료")
