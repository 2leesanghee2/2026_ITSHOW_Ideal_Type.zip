#!/usr/bin/env python3
"""
아이돌 그룹 이미지를 kprofiles.com에서 정확하게 매칭합니다.
scrape.py와 동일한 positional 방식 + 한글↔영문 이름 사전으로 매칭.

사용법: python fix_kprofiles.py [--dry]
  --dry   이미지 다운로드 없이 매칭 결과만 확인
"""
import sys, re, json, io, time, argparse
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install requests beautifulsoup4 lxml")

ROOT    = Path(__file__).parent.parent
DATA_JS = ROOT / "src" / "data.js"
IMG_DIR = ROOT / "public" / "images" / "celebs"
IMG_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://kprofiles.com/",
}

# ── 처리할 그룹 ───────────────────────────────────────────────────────────────
# (kprofiles URL, data.js group명)
TARGET_GROUPS = [
    ("https://kprofiles.com/illit-members-profile/",           "ILLIT"),
    ("https://kprofiles.com/wanna-one-members-profile/",       "WANNA ONE"),
    ("https://kprofiles.com/astro-members-profile/",           "ASTRO"),
    ("https://kprofiles.com/newjeans-members-profile/",        "NewJeans"),
    ("https://kprofiles.com/xdinary-heroes-members-profile/",  "XDINARY HEROES"),
]

# ── 한글 이름 → kprofiles 영문 Stage Name 매핑 ────────────────────────────────
# 값은 소문자 변환 후 비교. 여러 후보를 리스트로.
KO_TO_EN = {
    # ── ILLIT ─────────────────────────────────────────────────────────────────
    "윤아":    ["yunah", "yuna", "lee yunah"],
    "민주":    ["minju", "lee minju"],
    "모아":    ["moka", "moa"],
    "메리":    ["mary", "park mary", "iroha"],
    "원희":    ["wonhee", "choi wonhee"],
    # ── WANNA ONE ─────────────────────────────────────────────────────────────
    "강다니엘": ["kang daniel", "daniel"],
    "박지훈":   ["park jihoon", "jihoon"],
    "이대휘":   ["lee daehwi", "daehwi"],
    "김재환":   ["kim jaehwan", "jaehwan"],
    "옹성우":   ["ong seongwu", "seongwu", "seongwoo"],
    "박우진":   ["park woojin", "woojin"],
    "라이관린": ["lai guanlin", "lai guan lin", "guanlin", "kuanlin"],
    "윤지성":   ["yoon jisung", "jisung"],
    "황민현":   ["hwang minhyun", "minhyun"],
    "배진영":   ["bae jinyoung", "jinyoung"],
    "하성운":   ["ha sungwoon", "sungwoon"],
    # ── ASTRO ─────────────────────────────────────────────────────────────────
    "진진":  ["jinjin", "jin jin"],
    "엠제이": ["mj", "m.j"],
    "차은우": ["cha eunwoo", "eunwoo"],
    "산하":  ["sanha"],
    "라키":  ["rocky"],
    # ── NewJeans (영문 이름이라 직접 매칭) ───────────────────────────────────
    "하니":    ["hanni", "hani"],
    "Haerin":  ["haerin"],
    "Hyein":   ["hyein"],
    "Danielle":["danielle"],
    "Minji":   ["minji"],
    # ── XDINARY HEROES ────────────────────────────────────────────────────────
    "구민":   ["gumin", "gunil"],
    "정수":   ["jungsu"],
    "가온":   ["gaon"],
    "O.de":   ["o.de", "ode"],
    "박세진": ["sejin", "park sejin", "jun han"],
    "나이":   ["nye", "jooyeon"],
}

def clean_img_url(url: str) -> str:
    return re.sub(r"-\d+x\d+(?=\.\w{2,4}$)", "", url)

def img_ext(url: str) -> str:
    m = re.search(r"\.(\w{2,4})(?:[?#]|$)", url)
    return f".{m.group(1).lower()}" if m else ".jpg"

def fetch(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        return BeautifulSoup(r.text, "lxml")
    except Exception as e:
        print(f"  ⚠ 접속 실패: {e}", file=sys.stderr)
        return None

def download(url: str, path: Path) -> bool:
    try:
        r = requests.get(url, headers=HEADERS, timeout=20, stream=True)
        r.raise_for_status()
        ct = r.headers.get("Content-Type", "")
        if "image" not in ct and "octet" not in ct:
            return False
        with open(path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return path.stat().st_size > 2000
    except Exception:
        return False

def get_images_from_page(soup: BeautifulSoup) -> list[str]:
    """wp-content/uploads 이미지만 순서대로 추출"""
    content = (
        soup.find("div", class_="entry-content")
        or soup.find("div", class_=re.compile(r"post.content", re.I))
        or soup.body
    )
    if not content:
        return []
    imgs, seen = [], set()
    for tag in content.find_all("img"):
        src = tag.get("src") or tag.get("data-src") or ""
        if "wp-content/uploads" not in src:
            continue
        if any(x in src.lower() for x in ["logo", "icon", "banner", "advertisement"]):
            continue
        try:
            w = tag.get("width", "")
            if w and int(str(w).replace("px","")) < 80:
                continue
        except ValueError:
            pass
        clean = clean_img_url(src)
        if clean not in seen:
            seen.add(clean)
            imgs.append(clean)
    return imgs

def get_stage_names_from_page(soup: BeautifulSoup) -> list[str]:
    """Stage Name: 블록에서 첫 번째 이름 추출 (순서 보존)"""
    content = (
        soup.find("div", class_="entry-content")
        or soup.find("div", class_=re.compile(r"post.content", re.I))
        or soup.body
    )
    if not content:
        return []
    text   = content.get_text("\n")
    blocks = re.split(r"(?i)\bStage Name\s*[:\-]", text)
    names  = []
    for block in blocks[1:]:
        first = block.strip().split("\n")[0].strip()
        name  = re.sub(r"\s*\(.*?\)", "", first).strip()
        names.append(name)
    return names

def match_member(kp_stage: str, members: list[dict], used: set) -> dict | None:
    """kprofiles stage name → data.js member 매칭"""
    kp_lower = kp_stage.lower()
    for m in members:
        if m["id"] in used:
            continue
        ko_name = m["name"]
        # 직접 매치 (영문 이름인 경우: NewJeans Haerin 등)
        if ko_name.lower() == kp_lower or ko_name.lower() in kp_lower:
            return m
        # KO_TO_EN 사전 매치
        for alias in KO_TO_EN.get(ko_name, []):
            if alias in kp_lower or kp_lower in alias:
                return m
    return None

def scrape_group(url: str, group: str, data: list[dict], dry: bool) -> int:
    print(f"\n📄 {group}: {url}")
    soup = fetch(url)
    if not soup:
        return 0

    img_urls   = get_images_from_page(soup)
    stage_names = get_stage_names_from_page(soup)
    members    = [c for c in data if c["group"] == group]

    print(f"  kprofiles: {len(stage_names)}명 이름, {len(img_urls)}개 이미지")
    print(f"  data.js:   {len(members)}명")

    if not stage_names:
        print("  ⚠ Stage Name 블록 없음 — 스킵")
        return 0

    used   = set()
    ok     = 0

    for i, kp_name in enumerate(stage_names):
        img_url = img_urls[i] if i < len(img_urls) else None
        matched = match_member(kp_name, members, used)

        if matched is None:
            print(f"  ❔ [{i}] '{kp_name}' → 매칭 실패")
            continue

        used.add(matched["id"])
        cid = matched["id"]

        if img_url is None:
            print(f"  ⚠  [{i}] '{kp_name}' → {matched['name']} (이미지 없음)")
            continue

        if dry:
            print(f"  🔍 [{i}] '{kp_name}' → {matched['name']} | {img_url[:70]}")
            ok += 1
            continue

        ext  = img_ext(img_url)
        for old in IMG_DIR.glob(f"{cid:03d}.*"):
            old.unlink()
        path = IMG_DIR / f"{cid:03d}{ext}"
        print(f"  ⬇  [{i}] '{kp_name}' → {matched['name']} ... ", end="", flush=True)
        if download(img_url, path):
            matched["image"] = f"/images/celebs/{path.name}"
            ok += 1
            print(f"✅ {path.name}")
        else:
            print("❌ 다운로드 실패")
        time.sleep(0.5)

    return ok

# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry", action="store_true", help="매칭만 확인, 실제 다운로드 안 함")
    args = parser.parse_args()

    raw  = DATA_JS.read_text(encoding="utf-8")
    m    = re.search(r"export const CELEBRITIES\s*=\s*(\[[\s\S]*?\])\s*\n", raw)
    data: list[dict] = json.loads(m.group(1))

    total = 0
    for kp_url, group in TARGET_GROUPS:
        ok = scrape_group(kp_url, group, data, args.dry)
        total += ok
        time.sleep(2.0)

    if not args.dry:
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        DATA_JS.write_text(f"export const CELEBRITIES = {json_str}\n", encoding="utf-8")
        print(f"\n💾 data.js 저장 완료")

    print(f"\n{'─'*50}")
    print(f"{'✅ 매칭 확인' if args.dry else '✅ 완료'}: {total}명")

if __name__ == "__main__":
    main()
