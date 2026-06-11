#!/usr/bin/env python3
"""
나무위키 기반 이미지 재매칭 스크립트.
Wikipedia보다 한국 연예인 동명이인 처리가 정확합니다.

사용법:
  python fix_images_namu.py              # image=null인 것만
  python fix_images_namu.py --all        # 전체 재시도 (기존 이미지도 교체)
  python fix_images_namu.py --id 449     # 특정 id만
"""
import sys, re, json, io, time, argparse
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install requests beautifulsoup4")

ROOT    = Path(__file__).parent.parent
DATA_JS = ROOT / "src" / "data.js"
IMG_DIR = ROOT / "public" / "images" / "celebs"
IMG_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://namu.wiki/",
    "Accept-Language": "ko-KR,ko;q=0.9",
}

# ── 나무위키 검색어 오버라이드 ────────────────────────────────────────────────
# 형식: "data.js의 name" → ["나무위키 문서명1", "나무위키 문서명2", ...]
# 앞에서부터 순서대로 시도, 첫 번째 성공한 이미지 사용
NAMU_OVERRIDE = {
    # ── NewJeans ──────────────────────────────────────────────────────────────
    "하니":      ["하니(뉴진스)"],
    "Haerin":    ["김해린(뉴진스)", "Haerin"],
    "Hyein":     ["이혜인(뉴진스)"],
    "Danielle":  ["모 대니얼"],
    "Minji":     ["김민지(뉴진스)"],
    # ── ILLIT ─────────────────────────────────────────────────────────────────
    "윤아":      ["이윤아(아일릿)"],     # SNSD 윤아(이순규)와 구분
    "민주":      ["이민주(아일릿)"],
    "모아":      ["모아(아일릿)"],
    "메리":      ["박메리"],
    "원희":      ["최원희(아일릿)"],
    # ── ASTRO ─────────────────────────────────────────────────────────────────
    "진진":      ["박진진"],
    "엠제이":    ["김명준(아스트로)"],
    "차은우":    ["차은우"],
    "산하":      ["윤산하"],
    "라키":      ["박동현(아스트로)"],
    # ── EXO ───────────────────────────────────────────────────────────────────
    "루한":      ["루한(가수)"],
    "타오":      ["황쯔타오"],
    # ── WANNA ONE ─────────────────────────────────────────────────────────────
    "강다니엘":  ["강다니엘"],
    "박지훈":    ["박지훈(가수)"],
    "이대휘":    ["이대휘"],
    "김재환":    ["김재환(가수)"],
    "옹성우":    ["옹성우"],
    "박우진":    ["박우진(가수)"],
    "라이관린":  ["콰이관린"],
    "윤지성":    ["윤지성(가수)"],
    "황민현":    ["황민현"],
    "배진영":    ["배진영(가수)"],
    "하성운":    ["하성운"],
    # ── Brave Girls ───────────────────────────────────────────────────────────
    "유진":      ["유진(브레이브걸스)"],
    "혜란":      ["이혜란(브레이브걸스)"],
    "하윤":      ["남하윤"],
    # ── XDINARY HEROES ────────────────────────────────────────────────────────
    "구민":      ["구민(엑디즈)"],
    "정수":      ["정수(엑디즈)"],
    "가온":      ["가온(엑디즈)"],
    "O.de":      ["오경수(엑디즈)"],
    "박세진":    ["박세진(엑디즈)"],
    "나이":      ["나이(엑디즈)"],
    # ── CORTIS ────────────────────────────────────────────────────────────────
    "제임스":    ["제임스(코티즈)"],
    "주훈":      ["주훈(코티즈)"],
    "성현":      ["성현(코티즈)"],
    "건호":      ["건호(코티즈)"],
    "마틴":      ["마틴(코티즈)"],
    # ── BTS ───────────────────────────────────────────────────────────────────
    "뷔":        ["뷔(방탄소년단)"],
    # ── IVE ───────────────────────────────────────────────────────────────────
    "안유진":    ["안유진(아이브)"],
    "장원영":    ["장원영"],
    # ── Girl's Day ────────────────────────────────────────────────────────────
    "혜리":      ["혜리(걸스데이)"],
    "소진":      ["소진(걸스데이)"],
    "민아":      ["민아(걸스데이)"],
    "유라":      ["유라(걸스데이)"],
    # ── 배우 (동명이인 많은 경우) ─────────────────────────────────────────────
    "수지":      ["배수지"],
    "유다인":    ["유다인(배우)"],
    "김소은":    ["김소은(배우)"],
    "조유리":    ["조유리(배우)"],
    "박민영":    ["박민영(배우)"],
    "이민정":    ["이민정(배우)"],
    "신예은":    ["신예은(배우)"],
    "오하영":    ["오하영(배우)"],
    "이세영":    ["이세영(배우)"],
    "전여빈":    ["전여빈"],
    "표예진":    ["표예진"],
    "하연수":    ["하연수"],
    # ── 솔로 ──────────────────────────────────────────────────────────────────
    "비":        ["비(가수)"],
    "이승기":    ["이승기"],
    "이하이":    ["이하이"],
    "이효리":    ["이효리"],
    "엄정화":    ["엄정화"],
    "성유리":    ["성유리"],
    "손담비":    ["손담비"],
    # ── 운동선수 ──────────────────────────────────────────────────────────────
    "안산":      ["안산(양궁선수)"],
    "김길리":    ["김길리"],
    "김연경":    ["김연경"],
    "박태환":    ["박태환"],
    "김민재":    ["김민재(축구선수)"],
    "강하늘":    ["강하늘(배우)"],  # 배우 강하늘 (운동선수 강하늘과 구분)
    # ── 기타 배우 ─────────────────────────────────────────────────────────────
    "김남길":    ["김남길"],
    "박해일":    ["박해일"],
    "강동원":    ["강동원(배우)"],
}

def namu_image(doc_name: str) -> str | None:
    """나무위키 문서에서 인물 대표 이미지 URL 추출"""
    url = f"https://namu.wiki/w/{requests.utils.quote(doc_name)}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "lxml")

        # 나무위키 인물 인포박스 이미지: table.namu-infobox img
        for sel in [
            "table.namu-infobox img",
            "div.namu-infobox img",
            "div[class*='infobox'] img",
        ]:
            imgs = soup.select(sel)
            for img in imgs:
                src = img.get("src") or img.get("data-src") or ""
                if src.startswith("//"):
                    src = "https:" + src
                if not src.startswith("http"):
                    continue
                # 아이콘/배너 제외
                if any(x in src.lower() for x in ["icon", "logo", "badge", "flag", "award"]):
                    continue
                w = img.get("width", "")
                try:
                    if w and int(str(w).replace("px","")) < 80:
                        continue
                except ValueError:
                    pass
                return src

        # fallback: 본문 첫 번째 큰 이미지
        for img in soup.select("div.wiki-text img, div.wiki-paragraph img"):
            src = img.get("src") or img.get("data-src") or ""
            if src.startswith("//"):
                src = "https:" + src
            if "namu.wiki" in src or "upload" in src:
                return src
    except Exception as e:
        pass
    return None


def get_best_image(celeb: dict) -> str | None:
    name  = celeb["name"]
    group = celeb["group"]

    # 오버라이드 시도
    candidates = NAMU_OVERRIDE.get(name, [])

    # 기본 후보 (이름 그대로, 이름+직군)
    if group == "배우":
        defaults = [name, f"{name}(배우)"]
    elif group == "운동선수":
        defaults = [name, f"{name}(운동선수)"]
    elif group == "솔로":
        defaults = [name, f"{name}(가수)"]
    else:
        defaults = [name, f"{name}({group})"]

    all_queries = candidates + [q for q in defaults if q not in candidates]

    for q in all_queries:
        img = namu_image(q)
        if img:
            return img
        time.sleep(0.3)

    return None


def img_ext(url: str) -> str:
    m = re.search(r"\.(\w{2,4})(?:[?#]|$)", url)
    return f".{m.group(1).lower()}" if m else ".jpg"


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
        return path.stat().st_size > 3000
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--all",    action="store_true", help="이미지 있는 것도 재시도")
    parser.add_argument("--id",     type=int,            help="특정 id만 처리")
    parser.add_argument("--min-id", type=int, default=0, help="이 id 이상만 처리")
    args = parser.parse_args()

    text = DATA_JS.read_text(encoding="utf-8")
    m    = re.search(r"export const CELEBRITIES\s*=\s*(\[[\s\S]*?\])\s*\n", text)
    data: list[dict] = json.loads(m.group(1))

    if args.id:
        targets = [c for c in data if c["id"] == args.id]
    elif args.all:
        targets = [c for c in data if c["id"] >= args.min_id]
    else:
        targets = [c for c in data if not c.get("image") and c["id"] >= args.min_id]

    print(f"🔍 처리 대상: {len(targets)}명\n")

    ok = fail = skip = 0
    for i, c in enumerate(targets, 1):
        cid   = c["id"]
        name  = c["name"]
        group = c["group"]

        # --all 아닐 때 기존 파일 있으면 스킵
        if not args.all and not args.id:
            existing = list(IMG_DIR.glob(f"{cid:03d}.*"))
            if existing:
                c["image"] = f"/images/celebs/{existing[0].name}"
                skip += 1
                continue

        print(f"  [{i}/{len(targets)}] 🔎 {name} ({group}) ... ", end="", flush=True)
        img_url = get_best_image(c)

        if not img_url:
            print("❌ 이미지 없음")
            fail += 1
            continue

        ext  = img_ext(img_url)
        # 기존 파일 삭제 (--all 모드에서 확장자 변경 대비)
        for old in IMG_DIR.glob(f"{cid:03d}.*"):
            old.unlink()
        path = IMG_DIR / f"{cid:03d}{ext}"

        if download(img_url, path):
            c["image"] = f"/images/celebs/{path.name}"
            ok += 1
            print(f"✅ {path.name}")
        else:
            print(f"❌ 다운로드 실패")
            fail += 1

        time.sleep(0.6)

    # data.js 저장
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    DATA_JS.write_text(f"export const CELEBRITIES = {json_str}\n", encoding="utf-8")

    print(f"\n{'─'*50}")
    print(f"✅ {ok}명 완료  ⏭ {skip}명 스킵  ❌ {fail}명 실패")
    print(f"💾 data.js 저장 완료")


if __name__ == "__main__":
    main()
