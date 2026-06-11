-- ================================================================
-- 이상형.zip Supabase 스키마
-- Supabase SQL Editor에 붙여넣기 후 실행하세요.
-- ================================================================

-- ── 1. celebrities 테이블 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS celebrities (
  id          int          PRIMARY KEY,
  name        text         NOT NULL,
  emoji       text,
  "group"     text,
  mbti        text,
  score       int,
  gender      text,
  height      int,
  weight      int,
  age         int,
  nationality text,
  image       text
);

-- 이름·그룹 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_celebrities_group  ON celebrities("group");
CREATE INDEX IF NOT EXISTS idx_celebrities_gender ON celebrities(gender);

-- RLS: 누구나 읽기 가능, 쓰기는 service_role만
ALTER TABLE celebrities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "celebrities_select" ON celebrities;
CREATE POLICY "celebrities_select"
  ON celebrities FOR SELECT
  USING (true);

-- ── 2. scores 테이블 (방명록) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS scores (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  player       text         NOT NULL,
  celeb_name   text         NOT NULL,
  celeb_emoji  text,
  celeb_group  text,
  points       int,
  bracket_size int,
  message      text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_celeb     ON scores(celeb_name);
CREATE INDEX IF NOT EXISTS idx_scores_created   ON scores(created_at DESC);

-- RLS: 누구나 읽기·쓰기 (익명 방명록)
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scores_select" ON scores;
CREATE POLICY "scores_select"
  ON scores FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "scores_insert" ON scores;
CREATE POLICY "scores_insert"
  ON scores FOR INSERT
  WITH CHECK (true);

-- ── 3. 기존 celebrities 데이터 초기화 (재업로드 전) ──────────────
-- 아래 줄의 주석을 해제하면 전체 삭제 후 재삽입됩니다.
-- TRUNCATE celebrities;
