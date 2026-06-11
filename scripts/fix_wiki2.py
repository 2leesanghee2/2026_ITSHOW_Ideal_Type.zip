#!/usr/bin/env python3
"""
image=null 남은 연예인들의 이미지를 Wikipedia에서 정확하게 가져옵니다.
kprofiles로 처리 못한 그룹(WANNA ONE, ASTRO, NewJeans, 배우, 운동선수 등)용.

사용법: python fix_wiki2.py [--dry]
"""
import sys, re, json, io, time, argparse
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
except ImportError:
    sys.exit("pip install requests")

ROOT    = Path(__file__).parent.parent
DATA_JS = ROOT / "src" / "data.js"
IMG_DIR = ROOT / "public" / "images" / "celebs"
IMG_DIR.mkdir(parents=True, exist_ok=True)

WIKI_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; celebbot/1.0; +https://github.com/local)",
    "Accept": "application/json",
}
IMG_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://ko.wikipedia.org/",
    "Accept": "image/avif,image/webp,image/apng,image/jpeg,*/*;q=0.8",
}

# ── 정확한 Wikipedia 문서명 지정 ──────────────────────────────────────────────
# 형식: data.js "name" → ["한국어 위키 문서명", ...] (앞에서부터 시도)
WIKI_EXACT = {
    # WANNA ONE (각자 위키 문서 있음)
    "강다니엘": ["강다니엘"],
    "박지훈":   ["박지훈 (가수)"],
    "이대휘":   ["이대휘"],
    "김재환":   ["김재환 (가수)"],
    "옹성우":   ["옹성우"],
    "박우진":   ["박우진 (가수)"],
    "라이관린": ["콰이관린"],
    "윤지성":   ["윤지성 (가수)"],
    "황민현":   ["황민현"],
    "배진영":   ["배진영 (가수)"],
    "하성운":   ["하성운"],
    # ASTRO
    "진진":  ["진진 (가수)"],
    "엠제이": ["엠제이 (가수)"],
    "차은우": ["차은우"],
    "산하":  ["산하 (가수)"],
    "라키":  ["라키 (가수)"],
    # NewJeans (한국어 위키보다 영어 위키가 더 충실)
    "하니":     ["하니 (가수)"],
    "Haerin":   ["Haerin"],
    "Hyein":    ["Hyein"],
    "Danielle": ["대니얼 (가수)", "모 대니얼"],
    "Minji":    ["김민지 (뉴진스)", "Minji"],
    # XDINARY HEROES 박세진 (다운로드 실패)
    "박세진":   ["박세진 (가수)"],
    # CORTIS (작은 그룹 - Wikipedia 없을 수도)
    "제임스":   ["제임스 (CORTIS)", "James (CORTIS)"],
    "성현":     ["성현 (CORTIS)"],
    "건호":     ["건호 (CORTIS)"],
    # 배우
    "유다인":   ["유다인 (배우)"],
    "박해일":   ["박해일"],
    "강동원":   ["강동원 (배우)"],
    "김남길":   ["김남길"],
    "강하늘":   ["강하늘 (배우)"],
    "박민영":   ["박민영 (배우)"],
    "이민정":   ["이민정 (배우)"],
    "장나라":   ["장나라"],
    "조여정":   ["조여정"],
    "이세영":   ["이세영 (배우)"],
    "전여빈":   ["전여빈"],
    "표예진":   ["표예진"],
    "하연수":   ["하연수"],
    # 솔로
    "성유리":   ["성유리"],
    "손담비":   ["손담비"],
    # Girl's Day
    "유라":  ["유라 (걸스데이)"],
    "혜리":  ["혜리 (가수)"],
    "민아":  ["민아 (걸스데이)"],
    # 운동선수
    "김민재": ["김민재 (축구선수)"],
    "박태환": ["박태환"],
    "김연경": ["김연경"],
    "안산":   ["안산 (양궁 선수)"],
    "김길리": ["김길리"],
}

# 영어 Wikipedia fallback
WIKI_EN = {
    "Haerin":   ["Haerin (singer)"],
    "Hyein":    ["Hyein (singer)"],
    "Danielle": ["Danielle (New Jeans singer)"],
    "Minji":    ["Minji (New Jeans singer)"],
    "하니":     ["Hanni (singer)"],
    "차은우":   ["Cha Eun-woo"],
    "황민현":   ["Hwang Min-hyun"],
    "강다니엘": ["Kang Daniel"],
    "옹성우":   ["Ong Seong-wu"],
    "김연경":   ["Kim Yeon-koung"],
    "안산":     ["An San"],
    "박태환":   ["Park Tae-hwan"],
    "강동원":   ["Kang Dong-won"],
}

def wiki_ko(title: str) -> str | None:
    url = f"https://ko.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}"
    try:
        r = requests.get(url, headers=WIKI_HEADERS, timeout=12)
        if r.status_code == 200:
            d = r.json()
            src = (d.get("thumbnail") or {}).get("source") or \
                  (d.get("originalimage") or {}).get("source")
            if src:
                # 500px: Wikimedia 허용 크기
                src = re.sub(r"/\d+px-", "/500px-", src)
                return src
    except Exception:
        pass
    return None

def wiki_en(title: str) -> str | None:
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}"
    try:
        r = requests.get(url, headers=WIKI_HEADERS, timeout=12)
        if r.status_code == 200:
            d = r.json()
            src = (d.get("thumbnail") or {}).get("source") or \
                  (d.get("originalimage") or {}).get("source")
            if src:
                src = re.sub(r"/\d+px-", "/500px-", src)
                return src
    except Exception:
        pass
    return None

def wiki_search(name: str) -> str | None:
    """검색 API 폴백"""
    url = "https://ko.wikipedia.org/w/api.php"
    p = {"action":"query","list":"search","srsearch":name,"srlimit":3,"format":"json","utf8":1}
    try:
        r = requests.get(url, params=p, headers=WIKI_HEADERS, timeout=12)
        if r.ok:
            for res in r.json().get("query",{}).get("search",[]):
                img = wiki_ko(res["title"])
                if img:
                    return img
    except Exception:
        pass
    return None

def get_image_url(name: str, group: str) -> str | None:
    # 1. 정확한 문서명으로 시도
    for title in WIKI_EXACT.get(name, []):
        img = wiki_ko(title)
        if img:
            return img
        time.sleep(0.2)

    # 2. 기본 이름으로 시도
    for suffix in ["", f" ({group})", " (가수)", " (배우)", " (운동선수)"]:
        if suffix == f" ({group})" and group in ("배우","운동선수","솔로","Girl's Day"):
            pass
        img = wiki_ko(name + suffix)
        if img:
            return img
        time.sleep(0.15)

    # 3. 영어 위키 fallback
    for title in WIKI_EN.get(name, []):
        img = wiki_en(title)
        if img:
            return img
        time.sleep(0.2)

    # 4. 검색 API
    return wiki_search(name)

def img_ext(url: str) -> str:
    m = re.search(r"\.(\w{2,4})(?:[?#]|$)", url)
    return f".{m.group(1).lower()}" if m else ".jpg"

def download(url: str, path: Path) -> bool:
    for attempt in range(3):
        try:
            if attempt > 0:
                time.sleep(3 * attempt)
            r = requests.get(url, headers=IMG_HEADERS, timeout=25, stream=True)
            if r.status_code == 429:
                print(f"(429 rate-limit, 30초 대기)", end="")
                time.sleep(30)
                continue
            if r.status_code == 400 and "thumb" in url:
                # 허용 크기로 재시도: 400px
                url = re.sub(r"/\d+px-", "/400px-", url)
                continue
            r.raise_for_status()
            ct = r.headers.get("Content-Type", "")
            if "image" not in ct and "octet" not in ct:
                print(f"(Content-Type: {ct})", end="")
                return False
            with open(path, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)
            size = path.stat().st_size
            if size < 2000:
                path.unlink()
                print(f"(너무 작음: {size}B)", end="")
                return False
            return True
        except Exception as e:
            print(f"({e})", end="")
            if attempt == 2:
                return False
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry", action="store_true")
    parser.add_argument("--all", action="store_true", help="image=null만 아니라 WIKI_EXACT에 있는 것 전체 재시도")
    args = parser.parse_args()

    raw  = DATA_JS.read_text(encoding="utf-8")
    m    = re.search(r"export const CELEBRITIES\s*=\s*(\[[\s\S]*?\])\s*\n", raw)
    data: list[dict] = json.loads(m.group(1))

    if args.all:
        # WIKI_EXACT에 있는 이름이면 재처리
        targets = [c for c in data if c["name"] in WIKI_EXACT]
    else:
        targets = [c for c in data if not c.get("image")]

    # 기존 파일 있는 것 제외 (--all 아닐 때)
    if not args.all:
        final_targets = []
        for c in targets:
            existing = list(IMG_DIR.glob(f"{c['id']:03d}.*"))
            if existing:
                c["image"] = f"/images/celebs/{existing[0].name}"
                continue
            final_targets.append(c)
        targets = final_targets

    print(f"처리 대상: {len(targets)}명\n")

    ok = fail = 0
    for i, c in enumerate(targets, 1):
        cid  = c["id"]
        name = c["name"]
        grp  = c["group"]
        print(f"  [{i:3d}/{len(targets)}] {name} ({grp}) ... ", end="", flush=True)

        if args.dry:
            candidates = WIKI_EXACT.get(name, [name])
            print(f"→ 시도 예정: {candidates}")
            continue

        img_url = get_image_url(name, grp)
        if not img_url:
            print("❌ URL 없음")
            fail += 1
            time.sleep(0.3)
            continue

        ext  = img_ext(img_url)
        for old in IMG_DIR.glob(f"{cid:03d}.*"):
            old.unlink()
        path = IMG_DIR / f"{cid:03d}{ext}"

        if download(img_url, path):
            c["image"] = f"/images/celebs/{path.name}"
            ok += 1
            print(f"✅ {path.name}")
        else:
            print(f"❌")
            fail += 1

        time.sleep(2.5)

    if not args.dry:
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        DATA_JS.write_text(f"export const CELEBRITIES = {json_str}\n", encoding="utf-8")
        print(f"\n💾 data.js 저장 완료")

    print(f"\n{'─'*50}")
    print(f"✅ {ok}명  ❌ {fail}명")

if __name__ == "__main__":
    main()
