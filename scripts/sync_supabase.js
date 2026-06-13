/**
 * data.js → Supabase celebrities 테이블 동기화
 *
 * 사용법:
 *   1) .env 파일에 아래 두 값 설정 (또는 직접 상수에 입력):
 *      SUPABASE_URL=https://xxxx.supabase.co
 *      SUPABASE_SERVICE_KEY=eyJ...   ← service_role 키 (anon 아님!)
 *
 *   2) node scripts/sync_supabase.js
 *      (또는) node scripts/sync_supabase.js --clean  ← 기존 데이터 전체 삭제 후 재삽입
 *
 * 주의: service_role 키는 절대 클라이언트 코드에 포함하지 마세요.
 */

const fs   = require('fs')
const path = require('path')

// ── 설정 ─────────────────────────────────────────────────────────
// .env 파일 자동 로드 (존재할 경우)
try {
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const [k, ...v] = line.trim().split('=')
      if (k && !process.env[k]) process.env[k] = v.join('=').replace(/^["']|["']$/g, '')
    })
  }
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 환경변수가 없습니다.')
  console.error('   .env 파일을 확인하거나 직접 환경변수를 설정하세요.')
  process.exit(1)
}

const CLEAN = process.argv.includes('--clean')
const BATCH = 50  // 한 번에 upsert할 레코드 수

// ── data.js 파싱 ─────────────────────────────────────────────────
const dataJsPath = path.join(__dirname, '..', 'src', 'data.js')
const raw = fs.readFileSync(dataJsPath, 'utf-8')
const match = raw.match(/export const CELEBRITIES\s*=\s*(\[[\s\S]*?\])\s*\n/)
if (!match) { console.error('❌ data.js 파싱 실패'); process.exit(1) }
const celebrities = JSON.parse(match[1])

// ── Supabase REST API 헬퍼 ──────────────────────────────────────
async function supabaseReq(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer':        method === 'POST' ? 'resolution=merge-duplicates' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

// ── 메인 ─────────────────────────────────────────────────────────
;(async () => {
  console.log(`\n🚀 Supabase 동기화 시작 (${celebrities.length}명)\n`)

  if (CLEAN) {
    console.log('🗑  기존 celebrities 데이터 전체 삭제...')
    await supabaseReq('DELETE', '/celebrities?id=gte.0')
    console.log('   완료\n')
  }

  let ok = 0, fail = 0
  const batches = []
  for (let i = 0; i < celebrities.length; i += BATCH) {
    batches.push(celebrities.slice(i, i + BATCH))
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]
    const from = batch[0].id
    const to   = batch[batch.length - 1].id
    process.stdout.write(`  배치 [${b + 1}/${batches.length}] ID ${from}~${to} ... `)
    try {
      // score → popularity 컬럼명 매핑, group은 예약어지만 REST에선 그대로 사용
      const mapped = batch.map(({ score, ...rest }) => ({ ...rest, popularity: score }))
      await supabaseReq('POST', '/celebrities', mapped)
      ok += batch.length
      console.log(`✅ ${batch.length}건`)
    } catch (e) {
      fail += batch.length
      console.log(`❌ 실패: ${e.message.slice(0, 80)}`)
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`✅ 성공: ${ok}명  ❌ 실패: ${fail}명`)
  console.log(`\n💡 Supabase 테이블에서 확인: ${SUPABASE_URL}/project/_/editor\n`)
})()
