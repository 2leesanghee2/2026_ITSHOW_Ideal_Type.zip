#!/usr/bin/env python3
"""
Supabase 연예인 데이터 임포트
celebs.json → Supabase celebrities 테이블

사전 준비:
  1. supabase.com 에서 프로젝트 생성
  2. supabase/schema.sql 을 Supabase SQL Editor에서 실행
  3. Settings → API 에서 URL + service_role key 복사

사용법:
  python sb_import.py \\
    --url https://xxxx.supabase.co \\
    --key eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
"""

import sys, json, argparse, io, time
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
except ImportError:
    sys.exit("pip install requests 먼저 실행하세요")

CELEBS_JSON = Path(__file__).parent / "celebs.json"
BATCH_SIZE  = 500   # Supabase 한 번에 최대 업서트 수


def upsert(url: str, key: str, table: str, rows: list[dict]) -> None:
    endpoint = f"{url}/rest/v1/{table}"
    headers  = {
        "apikey":        key,
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    }
    # 배치 업서트
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        r = requests.post(endpoint, headers=headers, json=batch, timeout=30)
        if r.status_code not in (200, 201, 204):
            print(f"  ⚠ 배치 실패 ({r.status_code}): {r.text[:200]}", file=sys.stderr)
        else:
            print(f"  ✅ {min(i + BATCH_SIZE, len(rows))}/{len(rows)} 완료")
        time.sleep(0.3)


def main() -> None:
    parser = argparse.ArgumentParser(description="Supabase 데이터 임포트")
    parser.add_argument("--url", required=True, help="Supabase 프로젝트 URL")
    parser.add_argument("--key", required=True, help="service_role 키 (Settings → API)")
    parser.add_argument("--reset", action="store_true", help="기존 데이터 전체 삭제 후 재삽입")
    args = parser.parse_args()

    url = args.url.rstrip("/")

    # 접속 확인
    try:
        r = requests.get(f"{url}/rest/v1/celebrities?limit=1",
                         headers={"apikey": args.key, "Authorization": f"Bearer {args.key}"},
                         timeout=10)
        if r.status_code == 401:
            sys.exit("❌ 키가 잘못됐습니다. service_role 키를 사용하세요.")
        if r.status_code == 404:
            sys.exit("❌ celebrities 테이블이 없습니다. supabase/schema.sql 먼저 실행하세요.")
        print(f"✅ Supabase 연결 확인: {url}")
    except Exception as e:
        sys.exit(f"❌ 연결 실패: {e}")

    # celebs.json 로드
    if not CELEBS_JSON.exists():
        sys.exit("❌ celebs.json 없음. 먼저 scrape.py를 실행하세요.")
    with open(CELEBS_JSON, encoding="utf-8") as f:
        celebs = json.load(f)
    print(f"📂 celebs.json: {len(celebs)}명 로드")

    # 컬럼 매핑 (data.js의 score → popularity)
    rows = []
    for m in celebs:
        rows.append({
            "id":          m["id"],
            "name":        m["name"],
            "emoji":       m.get("emoji", ""),
            "group":       m.get("group", ""),
            "mbti":        m.get("mbti", ""),
            "popularity":  m.get("score", 0),
            "gender":      m.get("gender", ""),
            "height":      m.get("height", 0),
            "weight":      m.get("weight", 0),
            "age":         m.get("age", 0),
            "nationality": m.get("nationality", "한국"),
            "image":       m.get("image") or None,
        })

    if args.reset:
        print("\n🗑  기존 데이터 삭제 중...")
        r = requests.delete(
            f"{url}/rest/v1/celebrities?id=gte.0",
            headers={"apikey": args.key, "Authorization": f"Bearer {args.key}",
                     "Prefer": "return=minimal"},
            timeout=30
        )
        if r.status_code not in (200, 204):
            sys.exit(f"❌ 삭제 실패 ({r.status_code}): {r.text[:200]}")
        print("  ✅ 삭제 완료")

    print(f"\n🚀 celebrities 업서트 ({len(rows)}명)...")
    upsert(url, args.key, "celebrities", rows)

    print(f"\n✨ 완료! Supabase 대시보드에서 확인하세요.")
    print(f"   {url.replace('https://', 'https://supabase.com/dashboard/project/')}/editor")


if __name__ == "__main__":
    main()
