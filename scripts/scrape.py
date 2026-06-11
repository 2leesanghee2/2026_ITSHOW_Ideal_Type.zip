#!/usr/bin/env python3
"""
이상형.zip 연예인 크롤러 v2
kprofiles.com에서 K-pop 아이돌 프로필 + 대표 이미지를 수집합니다.

사용법:
  pip install -r requirements.txt
  python scrape.py                  # 전체 수집 (~63개 그룹 + 11명 솔로)
  python scrape.py --test           # 처음 3개 그룹만 테스트
  python scrape.py --skip-images    # 텍스트 데이터만, 이미지 다운로드 건너뜀
  python scrape.py --no-js          # JSON만 저장, data.js 갱신 안 함
"""

import sys, re, time, json, random, argparse, io
from datetime import date
from pathlib import Path

# Windows 터미널 UTF-8 강제 설정 (이모지 출력용)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install -r requirements.txt 먼저 실행하세요")

# ── 경로 ──────────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent.parent
OUT_JSON  = Path(__file__).parent / "celebs.json"
OUT_JS    = ROOT / "src" / "data.js"
IMG_DIR   = ROOT / "public" / "images" / "celebs"

# ── HTTP 설정 ─────────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
DELAY   = 1.5
TIMEOUT = 18

# ── 그룹 목록 (url, group명, 성별, 국적) ─────────────────────────────────────
GROUPS = [
    # ── 걸그룹 ─────────────────────────────────────────────────────────────────
    ("https://kprofiles.com/aespa-members-profile/",                     "aespa",        "여", "한국"),
    ("https://kprofiles.com/black-pink-members-profile/",                "BLACKPINK",    "여", "한국"),
    ("https://kprofiles.com/twice-members-profile/",                     "TWICE",        "여", "한국"),
    ("https://kprofiles.com/ive-members-profile/",                       "IVE",          "여", "한국"),
    ("https://kprofiles.com/newjeans-members-profile/",                  "NewJeans",     "여", "한국"),
    ("https://kprofiles.com/red-velvet-members-profile/",                "RED VELVET",   "여", "한국"),
    ("https://kprofiles.com/idle-members-profile/",                      "(G)I-DLE",     "여", "한국"),
    ("https://kprofiles.com/itzy-members-profile/",                      "ITZY",         "여", "한국"),
    ("https://kprofiles.com/le-sserafim-members-profile/",               "LE SSERAFIM",  "여", "한국"),
    ("https://kprofiles.com/mamamoo-members-profile/",                   "MAMAMOO",      "여", "한국"),
    ("https://kprofiles.com/apink-members-profile/",                     "Apink",        "여", "한국"),
    ("https://kprofiles.com/stayc-members-profile/",                     "STAYC",        "여", "한국"),
    ("https://kprofiles.com/babymonster-members-profile/",               "BABYMONSTER",  "여", "한국"),
    ("https://kprofiles.com/kep1er-members-profile/",                    "Kep1er",       "여", "한국"),
    ("https://kprofiles.com/girls-generation-snsd-members-profile/",     "SNSD",         "여", "한국"),
    ("https://kprofiles.com/loona-members-profile/",                     "LOONA",        "여", "한국"),
    ("https://kprofiles.com/oh-my-girl-members-profile/",                "OH MY GIRL",   "여", "한국"),
    ("https://kprofiles.com/wjsn-cosmic-girls-members-profile/",         "WJSN",         "여", "한국"),
    ("https://kprofiles.com/gfriend-members-profile/",                   "GFRIEND",      "여", "한국"),
    ("https://kprofiles.com/fx-members-profile/",                        "f(x)",         "여", "한국"),
    ("https://kprofiles.com/2ne1-members-profile/",                      "2NE1",         "여", "한국"),
    ("https://kprofiles.com/sistar-members-profile/",                    "SISTAR",       "여", "한국"),
    ("https://kprofiles.com/aoa-members-profile/",                       "AOA",          "여", "한국"),
    ("https://kprofiles.com/girls-day-members-profile/",                 "Girl's Day",   "여", "한국"),
    ("https://kprofiles.com/exid-members-profile/",                      "EXID",         "여", "한국"),
    ("https://kprofiles.com/t-ara-members-profile/",                     "T-ARA",        "여", "한국"),
    ("https://kprofiles.com/brave-girls-members-profile/",               "Brave Girls",  "여", "한국"),
    ("https://kprofiles.com/nmixx-members-profile/",                     "NMIXX",        "여", "한국"),
    ("https://kprofiles.com/weki-meki-members-profile/",                 "Weki Meki",    "여", "한국"),
    ("https://kprofiles.com/purple-kiss-members-profile/",               "Purple Kiss",  "여", "한국"),
    ("https://kprofiles.com/wonder-girls-members-profile/",              "Wonder Girls", "여", "한국"),
    ("https://kprofiles.com/4minute-members-profile/",                   "4MINUTE",      "여", "한국"),
    ("https://kprofiles.com/secret-members-profile/",                    "SECRET",       "여", "한국"),
    ("https://kprofiles.com/clc-members-profile/",                       "CLC",          "여", "한국"),
    ("https://kprofiles.com/illit-members-profile/",                     "ILLIT",        "여", "한국"),
    # ── 보이그룹 ───────────────────────────────────────────────────────────────
    ("https://kprofiles.com/bts-bangtan-boys-members-profile/",          "BTS",          "남", "한국"),
    ("https://kprofiles.com/exo-members-profile/",                       "EXO",          "남", "한국"),
    ("https://kprofiles.com/stray-kids-members-profile/",                "Stray Kids",   "남", "한국"),
    ("https://kprofiles.com/enhypen-members-profile/",                   "ENHYPEN",      "남", "한국"),
    ("https://kprofiles.com/txt-members-profile/",                       "TXT",          "남", "한국"),
    ("https://kprofiles.com/seventeen-members-profile/",                 "SEVENTEEN",    "남", "한국"),
    ("https://kprofiles.com/nct-127-members-profile/",                   "NCT 127",      "남", "한국"),
    ("https://kprofiles.com/got7-members-profile/",                      "GOT7",         "남", "한국"),
    ("https://kprofiles.com/big-bang-members-profile/",                  "BIGBANG",      "남", "한국"),
    ("https://kprofiles.com/2pm-members-profile/",                       "2PM",          "남", "한국"),
    ("https://kprofiles.com/monsta-x-members-profile/",                  "MONSTA X",     "남", "한국"),
    ("https://kprofiles.com/astro-members-profile/",                     "ASTRO",        "남", "한국"),
    ("https://kprofiles.com/the-boyz-members-profile/",                  "THE BOYZ",     "남", "한국"),
    ("https://kprofiles.com/ateez-members-profile/",                     "ATEEZ",        "남", "한국"),
    ("https://kprofiles.com/super-junior-members-profile/",              "Super Junior", "남", "한국"),
    ("https://kprofiles.com/shinee-members-profile/",                    "SHINee",       "남", "한국"),
    ("https://kprofiles.com/block-b-members-profile/",                   "Block B",      "남", "한국"),
    ("https://kprofiles.com/btob-members-profile/",                      "BTOB",         "남", "한국"),
    ("https://kprofiles.com/vixx-members-profile/",                      "VIXX",         "남", "한국"),
    ("https://kprofiles.com/ikon-members-profile/",                      "iKON",         "남", "한국"),
    ("https://kprofiles.com/winner-members-profile/",                    "WINNER",       "남", "한국"),
    ("https://kprofiles.com/day6-members-profile/",                      "DAY6",         "남", "한국"),
    ("https://kprofiles.com/cnblue-members-profile/",                    "CNBLUE",       "남", "한국"),
    ("https://kprofiles.com/highlight-members-profile/",                 "Highlight",    "남", "한국"),
    ("https://kprofiles.com/treasure-members-profile/",                  "TREASURE",     "남", "한국"),
    ("https://kprofiles.com/p1harmony-members-profile/",                 "P1Harmony",    "남", "한국"),
    ("https://kprofiles.com/oneus-members-profile/",                     "ONEUS",        "남", "한국"),
    ("https://kprofiles.com/nct-dream-members-profile/",                 "NCT DREAM",    "남", "한국"),
    ("https://kprofiles.com/infinite-members-profile/",                  "INFINITE",     "남", "한국"),
    ("https://kprofiles.com/nflying-members-profile/",                   "N.Flying",     "남", "한국"),
    ("https://kprofiles.com/ab6ix-members-profile/",                     "AB6IX",        "남", "한국"),
    ("https://kprofiles.com/tempest-members-profile/",                   "TEMPEST",      "남", "한국"),
    ("https://kprofiles.com/wanna-one-members-profile/",                 "WANNA ONE",    "남", "한국"),
]

# 솔로 아티스트 (url, 이름, 성별, 국적)
SOLOS = [
    ("https://kprofiles.com/iu-profile/",            "아이유",  "여", "한국"),
    ("https://kprofiles.com/taeyeon-profile/",       "태연",    "여", "한국"),
    ("https://kprofiles.com/chungha-profile/",       "청하",    "여", "한국"),
    ("https://kprofiles.com/sunmi-profile/",         "선미",    "여", "한국"),
    ("https://kprofiles.com/hyuna-profile/",         "현아",    "여", "한국"),
    ("https://kprofiles.com/heize-profile/",         "헤이즈",  "여", "한국"),
    ("https://kprofiles.com/taemin-profile/",        "태민",    "남", "한국"),
    ("https://kprofiles.com/baekhyun-exo-profile/",  "백현",    "남", "한국"),
    ("https://kprofiles.com/zico-profile/",          "지코",    "남", "한국"),
    ("https://kprofiles.com/crush-profile/",         "크러쉬",  "남", "한국"),
    ("https://kprofiles.com/dean-profile/",          "딘",      "남", "한국"),
]

# ── 그룹 이모지 ───────────────────────────────────────────────────────────────
GROUP_EMOJI = {
    "aespa":"💫","BLACKPINK":"🌹","TWICE":"🍑","IVE":"👑","NewJeans":"🐇",
    "RED VELVET":"🎀","(G)I-DLE":"🔥","ITZY":"⚡","LE SSERAFIM":"🦅",
    "MAMAMOO":"🌻","Apink":"🌸","STAYC":"🌟","BABYMONSTER":"👾","Kep1er":"🪐","SNSD":"🎵",
    "LOONA":"🌙","OH MY GIRL":"🐰","WJSN":"🚀","GFRIEND":"🌺","f(x)":"🦊",
    "2NE1":"💣","SISTAR":"🌊","AOA":"🪄","Girl's Day":"🌼","EXID":"🎸",
    "T-ARA":"♛","Brave Girls":"💪","NMIXX":"🎲","Weki Meki":"🤖","Purple Kiss":"💜",
    "Wonder Girls":"✨","4MINUTE":"⏱","SECRET":"🔮","CLC":"🦋",
    "ILLIT":"🌼","WANNA ONE":"⭐",
    "BTS":"🎤","EXO":"💎","Stray Kids":"🕷️","ENHYPEN":"🌙","TXT":"🦋",
    "SEVENTEEN":"✨","NCT 127":"🚀","GOT7":"🛸","BIGBANG":"🎸","2PM":"🔮",
    "MONSTA X":"💪","ASTRO":"⭐","THE BOYZ":"🃏","ATEEZ":"🏴‍☠️",
    "Super Junior":"💚","SHINee":"💠","Block B":"⬛","BTOB":"🔵","VIXX":"🌌",
    "iKON":"🎯","WINNER":"🏆","DAY6":"🎸","CNBLUE":"💙","Highlight":"🌟",
    "TREASURE":"💝","P1Harmony":"🎭","ONEUS":"🌙","NCT DREAM":"🌈",
    "INFINITE":"♾","N.Flying":"🎺","AB6IX":"🌐","TEMPEST":"⛈",
}
EMOJI_F = ["💃","🌺","🦋","🌙","💐","🌷","🎵","🌈","🦄","🍀"]
EMOJI_M = ["🎤","🌟","🔥","⚡","💪","🎸","✨","🎭","🎯","🚀"]

ALL_MBTI = [
    "INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
    "ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP",
]

# ── 파싱 유틸 ─────────────────────────────────────────────────────────────────

def to_cm(text: str) -> int | None:
    m = re.search(r"(\d{2,3})\s*cm", text, re.I)
    if m:
        v = int(m.group(1))
        return v if 140 <= v <= 215 else None
    m = re.search(r"(\d)'(\d{1,2})", text)
    if m:
        v = round(int(m.group(1)) * 30.48 + int(m.group(2)) * 2.54)
        return v if 140 <= v <= 215 else None
    return None


def to_kg(text: str) -> int | None:
    m = re.search(r"(\d{2,3})\s*kg", text, re.I)
    if m:
        v = int(m.group(1))
        return v if 35 <= v <= 130 else None
    m = re.search(r"(\d{2,3})\s*lb", text, re.I)
    if m:
        v = round(int(m.group(1)) * 0.4536)
        return v if 35 <= v <= 130 else None
    return None


def to_age(text: str) -> int | None:
    m = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", text)
    if m:
        try:
            bd = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            today = date.today()
            return today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
        except ValueError:
            pass
    m = re.search(r"\b(19[6-9]\d|200[0-9]|201\d)\b", text)
    if m:
        return date.today().year - int(m.group(1))
    return None


def to_mbti(text: str) -> str | None:
    pattern = r"\b(INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)\b"
    m = re.search(pattern, text.upper())
    return m.group(1) if m else None


def extract_name(line: str) -> str | None:
    m = re.search(r"\(([가-힣]{2,5})\)", line)
    if m:
        return m.group(1)
    m = re.search(r"^([가-힣]{2,5})", line.strip())
    if m:
        return m.group(1)
    name = re.sub(r"\s*\(.*?\)", "", line).strip()
    name = re.sub(r"[^A-Za-z\s]", "", name).strip()
    return name[:20] if len(name) >= 2 else None


# ── 이미지 처리 ───────────────────────────────────────────────────────────────

def clean_img_url(url: str) -> str:
    """WordPress 썸네일 크기 접미사 제거 (-300x300 등)"""
    return re.sub(r"-\d+x\d+(?=\.\w{2,4}$)", "", url)


def get_profile_images(soup: BeautifulSoup) -> list[str]:
    """페이지에서 프로필 이미지 URL 목록 추출 (wp-content/uploads만)"""
    imgs = []
    seen = set()
    content = (
        soup.find("div", class_="entry-content")
        or soup.find("div", class_=re.compile(r"post.content", re.I))
        or soup.body
    )
    if not content:
        return imgs

    for tag in content.find_all("img"):
        src = tag.get("src") or tag.get("data-src") or ""
        if "wp-content/uploads" not in src:
            continue
        # 아이콘·로고 제외
        if any(x in src.lower() for x in ["logo", "icon", "banner", "advertisement"]):
            continue
        # 너무 작은 이미지 제외
        w = tag.get("width")
        h = tag.get("height")
        try:
            if w and int(w) < 80:
                continue
            if h and int(h) < 80:
                continue
        except ValueError:
            pass
        clean = clean_img_url(src)
        if clean not in seen:
            seen.add(clean)
            imgs.append(clean)
    return imgs


def download_image(url: str, save_path: Path) -> bool:
    """이미지 다운로드. 성공 시 True."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True)
        r.raise_for_status()
        ct = r.headers.get("Content-Type", "")
        if "image" not in ct:
            return False
        save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except Exception:
        return False


def img_ext(url: str) -> str:
    m = re.search(r"\.(\w{2,4})(?:\?|$)", url)
    return f".{m.group(1).lower()}" if m else ".jpg"


# ── 크롤러 ────────────────────────────────────────────────────────────────────

def fetch_page(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        ct = r.headers.get("Content-Type", "")
        if "html" not in ct:
            print(f"    ⚠ HTML 아님 ({ct}): {url}", file=sys.stderr)
            return None
        return BeautifulSoup(r.text, "lxml")
    except requests.HTTPError as e:
        print(f"    ⚠ HTTP {e.response.status_code}: {url}", file=sys.stderr)
    except Exception as e:
        print(f"    ⚠ 연결 실패: {e}", file=sys.stderr)
    return None


def parse_block(block: str, group: str, gender: str, nationality: str, img_url: str | None = None) -> dict | None:
    lines = [l.strip() for l in block.split("\n") if l.strip()]
    if not lines:
        return None

    name = extract_name(lines[0])
    if not name or len(name) < 2:
        return None

    chunk = "\n".join(lines[:50])

    def field(pattern: str) -> str | None:
        m = re.search(pattern, chunk, re.I)
        return m.group(1).strip() if m else None

    height_raw = field(r"Height\s*[:\-]\s*(.+)")
    weight_raw = field(r"Weight\s*[:\-]\s*(.+)")
    birth_raw  = field(r"(?:Birthday|Born|Date of Birth)\s*[:\-]\s*(.+)")
    mbti_raw   = field(r"MBTI(?:\s*Type)?\s*[:\-]?\s*([A-Za-z]{4})")

    member: dict = {
        "name":        name,
        "group":       group,
        "gender":      gender,
        "nationality": nationality,
    }
    if img_url:
        member["_img_url"] = img_url

    h  = to_cm(height_raw) if height_raw else None
    w  = to_kg(weight_raw) if weight_raw else None
    a  = to_age(birth_raw) if birth_raw else None
    mb = to_mbti(mbti_raw) if mbti_raw else to_mbti(chunk)

    if h:  member["height"] = h
    if w:  member["weight"] = w
    if a and 15 <= a <= 60: member["age"] = a
    if mb: member["mbti"] = mb

    has_data = any(k in member for k in ("height", "weight", "age", "mbti"))
    return member if has_data else None


def scrape_group(url: str, group: str, gender: str, nationality: str) -> list[dict]:
    soup = fetch_page(url)
    if not soup:
        return []

    content = (
        soup.find("div", class_="entry-content")
        or soup.find("div", class_=re.compile(r"post.content", re.I))
        or soup.body
    )
    if not content:
        return []

    # 이미지 목록 수집
    img_urls = get_profile_images(soup)

    text = content.get_text("\n")
    blocks = re.split(r"(?i)\bStage Name\s*[:\-]", text)
    if len(blocks) < 2:
        blocks = re.split(r"\n(?=[A-Z가-힣][a-z가-힣]{1,10}\s*\n)", text)

    members = []
    for i, block in enumerate(blocks[1:]):
        img_url = img_urls[i] if i < len(img_urls) else None
        m = parse_block(block, group, gender, nationality, img_url)
        if m:
            members.append(m)

    return members


def scrape_solo(url: str, name: str, gender: str, nationality: str) -> dict | None:
    """솔로 아티스트 전용 파서 (Stage Name 분리 없이 전체 텍스트 파싱)"""
    soup = fetch_page(url)
    if not soup:
        return None

    content = (
        soup.find("div", class_="entry-content")
        or soup.find("div", class_=re.compile(r"post.content", re.I))
        or soup.body
    )
    if not content:
        return None

    img_urls = get_profile_images(soup)
    img_url  = img_urls[0] if img_urls else None

    text  = content.get_text("\n")
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    chunk = "\n".join(lines[:80])

    def field(pattern: str) -> str | None:
        m = re.search(pattern, chunk, re.I)
        return m.group(1).strip() if m else None

    height_raw = field(r"Height\s*[:\-]\s*(.+)")
    weight_raw = field(r"Weight\s*[:\-]\s*(.+)")
    birth_raw  = field(r"(?:Birthday|Born|Date of Birth)\s*[:\-]\s*(.+)")
    mbti_raw   = field(r"MBTI(?:\s*Type)?\s*[:\-]?\s*([A-Za-z]{4})")

    member: dict = {
        "name":        name,
        "group":       "솔로",
        "gender":      gender,
        "nationality": nationality,
    }
    if img_url:
        member["_img_url"] = img_url

    h  = to_cm(height_raw) if height_raw else None
    w  = to_kg(weight_raw) if weight_raw else None
    a  = to_age(birth_raw) if birth_raw else None
    mb = to_mbti(mbti_raw) if mbti_raw else to_mbti(chunk)

    if h:  member["height"] = h
    if w:  member["weight"] = w
    if a and 15 <= a <= 60: member["age"] = a
    if mb: member["mbti"] = mb

    has_data = any(k in member for k in ("height", "weight", "age", "mbti"))
    return member if has_data else None


# ── 이미지 일괄 다운로드 ──────────────────────────────────────────────────────

def download_all_images(members: list[dict]) -> int:
    """members의 _img_url을 public/images/celebs/에 저장하고 image 필드 설정"""
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    ok = 0
    total = sum(1 for m in members if m.get("_img_url"))
    print(f"\n📸 이미지 다운로드 시작 ({total}명)")

    for m in members:
        url = m.pop("_img_url", None)
        if not url:
            m["image"] = None
            continue

        ext      = img_ext(url)
        slug     = re.sub(r"[^\w가-힣]", "_", m["name"])
        filename = f"{m['id']:03d}_{slug}{ext}"
        path     = IMG_DIR / filename

        if path.exists():
            m["image"] = f"/images/celebs/{filename}"
            ok += 1
            continue

        if download_image(url, path):
            m["image"] = f"/images/celebs/{filename}"
            ok += 1
            print(f"  ✅ {filename}")
        else:
            m["image"] = None
            print(f"  ❌ {m['name']} ({url[:60]}...)")

        time.sleep(0.5)

    print(f"  → {ok}/{total}명 이미지 완료")
    return ok


# ── 후처리 ────────────────────────────────────────────────────────────────────

def finalize(raw: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out:  list[dict] = []
    emoji_counter: dict[str, int] = {}

    for m in raw:
        key = f"{m['name']}|{m['group']}"
        if key in seen:
            continue
        seen.add(key)

        gender = m.get("gender", "여")
        group  = m.get("group", "")

        ec         = emoji_counter.get(group, 0)
        emoji_list = EMOJI_F if gender == "여" else EMOJI_M
        emoji      = GROUP_EMOJI.get(group, emoji_list[ec % len(emoji_list)])
        emoji_counter[group] = ec + 1

        if gender == "여":
            h_def, w_def, a_def = random.randint(160, 172), random.randint(45, 55), random.randint(20, 31)
        else:
            h_def, w_def, a_def = random.randint(173, 186), random.randint(60, 73), random.randint(22, 35)

        entry: dict = {
            "id":          len(out) + 1,
            "name":        m["name"],
            "emoji":       emoji,
            "group":       group,
            "mbti":        m.get("mbti") or random.choice(ALL_MBTI),
            "score":       random.randint(5000, 9900),
            "gender":      gender,
            "height":      m.get("height", h_def),
            "weight":      m.get("weight", w_def),
            "age":         m.get("age",    a_def),
            "nationality": m.get("nationality", "한국"),
        }
        # _img_url은 다운로드 단계에서 처리하므로 여기선 임시 보존
        if "_img_url" in m:
            entry["_img_url"] = m["_img_url"]

        out.append(entry)

    return out


# ── data.js 생성 ──────────────────────────────────────────────────────────────

LEADERBOARD_DUMMY = [
    ("태양이엄마", "카리나",  9842),
    ("아미아미",   "지민",    9321),
    ("분홍돼지",   "아이유",  8743),
    ("별빛여우",   "차은우",  8997),
    ("하늘구름",   "제니",    8512),
    ("새벽달",     "뷔",      8201),
    ("달빛토끼",   "윈터",    7988),
    ("초록별",     "박보검",  7654),
    ("은하수",     "카리나",  7201),
    ("무지개꿈",   "아이유",  6988),
]


def write_data_js(members: list[dict], path: Path) -> None:
    lines = ["export const CELEBRITIES = ["]
    for m in members:
        name  = m["name"].replace("'", "\\'")
        group = m["group"].replace("'", "\\'")
        image = f"'{m['image']}'" if m.get("image") else "null"
        lines.append(
            f"  {{ id:{m['id']}, name:'{name}', emoji:'{m['emoji']}', "
            f"group:'{group}', mbti:'{m['mbti']}', score:{m['score']}, "
            f"gender:'{m['gender']}', height:{m['height']}, weight:{m['weight']}, "
            f"age:{m['age']}, nationality:'{m['nationality']}', image:{image} }},"
        )
    lines.append("]")
    lines.append("")
    lines.append("export const LEADERBOARD = [")
    for player, celeb, score in LEADERBOARD_DUMMY:
        lines.append(f"  {{ player:'{player}', celeb:'{celeb}', score:{score} }},")
    lines.append("]")

    path.write_text("\n".join(lines), encoding="utf-8")


# ── 진입점 ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="이상형.zip 연예인 크롤러 v2")
    parser.add_argument("--test",         action="store_true", help="처음 3개 그룹만 테스트")
    parser.add_argument("--skip-images",  action="store_true", help="이미지 다운로드 건너뜀 (image=null)")
    parser.add_argument("--url-images",   action="store_true", help="이미지 URL을 그대로 저장 (다운로드 없음, 인터넷 필요)")
    parser.add_argument("--no-js",        action="store_true", help="data.js 갱신 건너뜀")
    args = parser.parse_args()

    group_targets = GROUPS[:3] if args.test else GROUPS
    solo_targets  = SOLOS[:2]  if args.test else SOLOS
    all_raw: list[dict] = []
    failed: list[str]   = []

    total = len(group_targets) + len(solo_targets)
    print(f"🚀 총 {len(group_targets)}개 그룹 + {len(solo_targets)}명 솔로 수집 시작\n")

    # 그룹 수집
    for idx, (url, group, gender, nationality) in enumerate(group_targets, 1):
        print(f"[{idx:02d}/{total}] {group} ... ", end="", flush=True)
        members = scrape_group(url, group, gender, nationality)
        if members:
            print(f"{len(members)}명 ✅")
            all_raw.extend(members)
        else:
            print("0명 ❌")
            failed.append(f"{group}: {url}")
        if idx < total:
            time.sleep(DELAY)

    # 솔로 수집
    for idx, (url, name, gender, nationality) in enumerate(solo_targets, len(group_targets) + 1):
        print(f"[{idx:02d}/{total}] {name} (솔로) ... ", end="", flush=True)
        m = scrape_solo(url, name, gender, nationality)
        if m:
            print("✅")
            all_raw.append(m)
        else:
            print("❌")
            failed.append(f"{name}: {url}")
        if idx < total:
            time.sleep(DELAY)

    print(f"\n─────────────────────────────────────────")
    print(f"📊 수집 완료: {len(all_raw)}명 (원시)")

    final = finalize(all_raw)
    print(f"📊 중복 제거 후: {len(final)}명")

    # 이미지 처리
    if args.url_images:
        # URL 그대로 저장 (다운로드 없음)
        count = 0
        for m in final:
            url = m.pop("_img_url", None)
            m["image"] = url if url else None
            if url: count += 1
        print(f"🔗 이미지 URL 저장: {count}명")
    elif args.skip_images:
        for m in final:
            m.pop("_img_url", None)
            m["image"] = None
        print("⏭ 이미지 건너뜀 (--skip-images)")
    else:
        download_all_images(final)

    # JSON 저장 (image 필드 포함, _img_url 제거)
    for m in final:
        m.pop("_img_url", None)

    OUT_JSON.write_text(json.dumps(final, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"💾 JSON → {OUT_JSON.name}")

    if not args.no_js:
        write_data_js(final, OUT_JS)
        print(f"💾 data.js → {OUT_JS}")

    if failed:
        print(f"\n⚠ 실패한 항목 ({len(failed)}개):")
        for f in failed:
            print(f"   {f}")

    print(f"\n✨ 완료! {len(final)}명 / 이미지 경로: {IMG_DIR}")


if __name__ == "__main__":
    main()
