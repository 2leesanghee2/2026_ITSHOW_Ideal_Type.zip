#!/usr/bin/env python3
"""
PocketBase 초기 설정 + 연예인 데이터 임포트
celebs.json → PocketBase celebrities 컬렉션

사용법:
  python pb_import.py --email admin@example.com --password yourpassword

사전 준비:
  1. pocketbase.exe를 프로젝트 루트/pocketbase/ 폴더에 저장
  2. pocketbase serve 실행 (기본 http://127.0.0.1:8090)
  3. http://127.0.0.1:8090/_/ 에서 관리자 계정 생성
  4. 이 스크립트 실행
"""

import sys, json, argparse, io, time
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
except ImportError:
    sys.exit("pip install requests 먼저 실행하세요")

BASE      = "http://127.0.0.1:8090"
CELEBS_JSON = Path(__file__).parent / "celebs.json"

# ── 컬렉션 스키마 ──────────────────────────────────────────────────────────────

CELEBRITIES_SCHEMA = {
    "name": "celebrities",
    "type": "base",
    "listRule":   "",   # 누구나 읽기 가능
    "viewRule":   "",
    "createRule": None, # 관리자만
    "updateRule": None,
    "deleteRule": None,
    "schema": [
        {"name": "name",        "type": "text",   "required": True},
        {"name": "emoji",       "type": "text"},
        {"name": "group",       "type": "text"},
        {"name": "mbti",        "type": "text"},
        {"name": "popularity",  "type": "number"},
        {"name": "gender",      "type": "text"},
        {"name": "height",      "type": "number"},
        {"name": "weight",      "type": "number"},
        {"name": "age",         "type": "number"},
        {"name": "nationality", "type": "text"},
        {"name": "image",       "type": "text"},
    ],
}

SCORES_SCHEMA = {
    "name": "scores",
    "type": "base",
    "listRule":   "",   # 누구나 읽기
    "viewRule":   "",
    "createRule": "",   # 누구나 쓰기 (게임 종료 후 자동 저장)
    "updateRule": None,
    "deleteRule": None,
    "schema": [
        {"name": "player",       "type": "text"},
        {"name": "celeb_name",   "type": "text"},
        {"name": "celeb_emoji",  "type": "text"},
        {"name": "points",       "type": "number"},
        {"name": "bracket_size", "type": "number"},
    ],
}


# ── PocketBase API 헬퍼 ────────────────────────────────────────────────────────

def admin_auth(email: str, password: str) -> str:
    """관리자 토큰 반환"""
    r = requests.post(f"{BASE}/api/admins/auth-with-password",
                      json={"identity": email, "password": password}, timeout=10)
    if r.status_code != 200:
        sys.exit(f"❌ 관리자 로그인 실패: {r.status_code} {r.text[:200]}")
    token = r.json()["token"]
    print("✅ 관리자 로그인 성공")
    return token


def get_collections(token: str) -> set[str]:
    r = requests.get(f"{BASE}/api/collections?perPage=200",
                     headers={"Authorization": token}, timeout=10)
    r.raise_for_status()
    return {c["name"] for c in r.json().get("items", [])}


def create_collection(schema: dict, token: str) -> None:
    name = schema["name"]
    r = requests.post(f"{BASE}/api/collections",
                      json=schema,
                      headers={"Authorization": token, "Content-Type": "application/json"},
                      timeout=10)
    if r.status_code in (200, 204):
        print(f"  ✅ 컬렉션 생성: {name}")
    else:
        print(f"  ⚠ 컬렉션 생성 실패 ({name}): {r.status_code} {r.text[:120]}", file=sys.stderr)


def delete_all_records(collection: str, token: str) -> None:
    """기존 레코드 전체 삭제 (재임포트 시)"""
    page = 1
    deleted = 0
    while True:
        r = requests.get(f"{BASE}/api/collections/{collection}/records?perPage=200&page={page}",
                         headers={"Authorization": token}, timeout=10)
        if r.status_code != 200:
            break
        items = r.json().get("items", [])
        if not items:
            break
        for item in items:
            requests.delete(f"{BASE}/api/collections/{collection}/records/{item['id']}",
                            headers={"Authorization": token}, timeout=10)
            deleted += 1
        page += 1
    if deleted:
        print(f"  🗑  기존 레코드 {deleted}개 삭제")


def import_celebrities(records: list[dict], token: str) -> None:
    ok = err = 0
    for m in records:
        payload = {
            "name":        m.get("name", ""),
            "emoji":       m.get("emoji", ""),
            "group":       m.get("group", ""),
            "mbti":        m.get("mbti", ""),
            "popularity":  m.get("score", 0),
            "gender":      m.get("gender", ""),
            "height":      m.get("height", 0),
            "weight":      m.get("weight", 0),
            "age":         m.get("age", 0),
            "nationality": m.get("nationality", "한국"),
            "image":       m.get("image") or "",
        }
        r = requests.post(
            f"{BASE}/api/collections/celebrities/records",
            json=payload,
            headers={"Authorization": token, "Content-Type": "application/json"},
            timeout=10,
        )
        if r.status_code in (200, 204):
            ok += 1
        else:
            err += 1
            if err <= 3:
                print(f"  ⚠ 임포트 실패 ({m.get('name')}): {r.text[:80]}", file=sys.stderr)
    print(f"  ✅ {ok}명 임포트 완료 / ❌ {err}명 실패")


# ── 진입점 ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="PocketBase 데이터 임포트")
    parser.add_argument("--email",    required=True, help="관리자 이메일")
    parser.add_argument("--password", required=True, help="관리자 비밀번호")
    parser.add_argument("--reset",    action="store_true", help="기존 레코드 삭제 후 재임포트")
    args = parser.parse_args()

    # PocketBase 접속 확인
    try:
        requests.get(f"{BASE}/api/health", timeout=5).raise_for_status()
        print(f"✅ PocketBase 연결 확인: {BASE}")
    except Exception:
        sys.exit(f"❌ PocketBase에 연결할 수 없습니다. pocketbase serve 실행 중인지 확인하세요.\n   주소: {BASE}")

    # celebs.json 확인
    if not CELEBS_JSON.exists():
        sys.exit("❌ celebs.json 없음. 먼저 scrape.py를 실행하세요.")
    with open(CELEBS_JSON, encoding="utf-8") as f:
        celebs = json.load(f)
    print(f"📂 celebs.json: {len(celebs)}명 로드")

    token = admin_auth(args.email, args.password)
    existing = get_collections(token)

    # 컬렉션 생성
    print("\n📋 컬렉션 설정...")
    if "celebrities" not in existing:
        create_collection(CELEBRITIES_SCHEMA, token)
    else:
        print("  ✅ celebrities 컬렉션 이미 존재")

    if "scores" not in existing:
        create_collection(SCORES_SCHEMA, token)
    else:
        print("  ✅ scores 컬렉션 이미 존재")

    # 기존 레코드 삭제 (--reset 옵션)
    if args.reset:
        print("\n🗑  기존 데이터 초기화...")
        delete_all_records("celebrities", token)

    # 연예인 데이터 임포트
    print(f"\n🚀 celebrities 임포트 ({len(celebs)}명)...")
    import_celebrities(celebs, token)

    print(f"\n✨ 완료! http://127.0.0.1:8090/_/ 에서 확인하세요.")


if __name__ == "__main__":
    main()
