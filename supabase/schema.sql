-- Supabase SQL Editor에 붙여넣고 실행하세요

-- 1. 연예인 테이블
create table if not exists celebrities (
  id          int primary key,
  name        text not null,
  emoji       text,
  "group"     text,
  mbti        text,
  popularity  int,
  gender      text,
  height      int,
  weight      int,
  age         int,
  nationality text,
  image       text
);

-- 2. 방명록 테이블
create table if not exists scores (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  player       text,
  celeb_name   text,
  celeb_emoji  text,
  points       int,
  bracket_size int,
  message      text
);

-- 3. RLS 정책 (공개 읽기, scores는 공개 쓰기도)
alter table celebrities enable row level security;
alter table scores       enable row level security;

create policy "public read celebrities"
  on celebrities for select using (true);

create policy "public read scores"
  on scores for select using (true);

create policy "public insert scores"
  on scores for insert with check (true);
