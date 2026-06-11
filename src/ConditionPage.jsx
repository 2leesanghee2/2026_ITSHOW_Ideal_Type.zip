import React, { useState, useRef } from 'react'

const DEFAULT = {
  gender: '전체',
  heightMin: 155,
  heightMax: 190,
  weightMin: 40,
  weightMax: 80,
  ageMin: 17,
  ageMax: 40,
  nationality: '전체',
  mbtiEI: '전체',   // 'E' | 'I' | '전체'
  mbtiNS: '전체',   // 'N' | 'S' | '전체'
  mbtiTF: '전체',   // 'T' | 'F' | '전체'
  mbtiJP: '전체',   // 'J' | 'P' | '전체'
}

function filterCelebs(cond, celebrities) {
  return (celebrities || []).filter(c => {
    if (cond.gender !== '전체' && c.gender !== cond.gender) return false
    if (c.height < cond.heightMin || c.height > cond.heightMax) return false
    if (c.weight < cond.weightMin || c.weight > cond.weightMax) return false
    if (c.age < cond.ageMin || c.age > cond.ageMax) return false
    if (cond.nationality !== '전체' && c.nationality !== cond.nationality) return false
    if (cond.mbtiEI !== '전체' && c.mbti && !c.mbti.includes(cond.mbtiEI)) return false
    if (cond.mbtiNS !== '전체' && c.mbti && !c.mbti.includes(cond.mbtiNS)) return false
    if (cond.mbtiTF !== '전체' && c.mbti && !c.mbti.includes(cond.mbtiTF)) return false
    if (cond.mbtiJP !== '전체' && c.mbti && !c.mbti.includes(cond.mbtiJP)) return false
    return true
  })
}

function RangeSlider({ label, min, max, valMin, valMax, unit, onChange }) {
  const trackRef = useRef(null)
  const dragging = useRef(null)

  const pctMin = ((valMin - min) / (max - min)) * 100
  const pctMax = ((valMax - min) / (max - min)) * 100

  const pctToVal = (pct) => Math.round(min + (Math.max(0, Math.min(100, pct)) / 100) * (max - min))

  const getPct = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    return ((e.clientX - rect.left) / rect.width) * 100
  }

  const onThumbDown = (e, thumb) => {
    e.preventDefault()
    dragging.current = thumb
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onThumbMove = (e) => {
    if (!dragging.current) return
    const val = pctToVal(getPct(e))
    if (dragging.current === 'min') onChange(Math.min(val, valMax - 1), valMax)
    else onChange(valMin, Math.max(val, valMin + 1))
  }

  const onThumbUp = () => { dragging.current = null }

  const thumbStyle = (pct, colors, glow) => ({
    position: 'absolute',
    left: `calc(${pct}% - 10px)`,
    width: 20, height: 20, borderRadius: '50%',
    background: colors,
    border: '2px solid rgba(255,255,255,.85)',
    boxShadow: `0 0 10px ${glow}`,
    cursor: 'grab', touchAction: 'none',
    transition: 'box-shadow .15s',
  })

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: 'rgba(255,255,255,.65)', fontSize: 11, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
        <span style={{
          background: 'rgba(20,184,166,.12)', border: '1px solid rgba(20,184,166,.25)',
          borderRadius: 100, padding: '3px 12px',
          color: '#2dd4bf', fontSize: 13, fontWeight: 700,
        }}>{valMin}{unit} – {valMax}{unit}</span>
      </div>
      <div ref={trackRef} style={{ position: 'relative', height: 36, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2 }} />
        <div style={{
          position: 'absolute', height: 4, borderRadius: 2,
          background: 'linear-gradient(90deg,#14b8a6,#22d3ee)',
          left: `${pctMin}%`, width: `${pctMax - pctMin}%`,
          boxShadow: '0 0 8px rgba(20,184,166,.5)',
        }} />
        <div
          onPointerDown={e => onThumbDown(e, 'min')}
          onPointerMove={onThumbMove}
          onPointerUp={onThumbUp}
          style={thumbStyle(pctMin, 'linear-gradient(135deg,#14b8a6,#0d9488)', 'rgba(20,184,166,.7)')}
        />
        <div
          onPointerDown={e => onThumbDown(e, 'max')}
          onPointerMove={onThumbMove}
          onPointerUp={onThumbUp}
          style={thumbStyle(pctMax, 'linear-gradient(135deg,#22d3ee,#06b6d4)', 'rgba(34,211,238,.7)')}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 10 }}>{min}{unit}</span>
        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 10 }}>{max}{unit}</span>
      </div>
    </div>
  )
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          flex: 1, padding: '11px 8px', borderRadius: 10, cursor: 'pointer',
          fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, fontWeight: 700,
          transition: 'all .18s',
          border: value === opt ? '1px solid rgba(20,184,166,.7)' : '1px solid rgba(255,255,255,.2)',
          background: value === opt ? 'rgba(20,184,166,.28)' : 'rgba(255,255,255,.08)',
          color: value === opt ? '#5eead4' : 'rgba(255,255,255,.7)',
          boxShadow: value === opt ? '0 0 14px rgba(20,184,166,.2)' : 'none',
        }}>{opt}</button>
      ))}
    </div>
  )
}

// MBTI 축 색상 팔레트
const AXIS_COLORS = {
  EI: { hue: '263', color: '#a78bfa', bg: 'rgba(139,92,246,' },   // 보라
  NS: { hue: '199', color: '#67e8f9', bg: 'rgba(34,211,238,'  },   // 하늘
  TF: { hue: '340', color: '#f9a8d4', bg: 'rgba(236,72,153,'  },   // 핑크
  JP: { hue: '142', color: '#86efac', bg: 'rgba(34,197,94,'   },   // 초록
}

const AXIS_META = [
  { key: 'EI', left: 'E', right: 'I', leftKo: '외향',  rightKo: '내향',  label: '에너지' },
  { key: 'NS', left: 'N', right: 'S', leftKo: '직관',  rightKo: '감각',  label: '인식'   },
  { key: 'TF', left: 'T', right: 'F', leftKo: '사고',  rightKo: '감정',  label: '판단'   },
  { key: 'JP', left: 'J', right: 'P', leftKo: '계획',  rightKo: '탐색',  label: '생활'   },
]

function MbtiFilter({ cond, onChange }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {AXIS_META.map(({ key, left, right, leftKo, rightKo, label }) => {
          const condKey = `mbti${key}`
          const val     = cond[condKey]
          const { color, bg } = AXIS_COLORS[key]
          return (
            <div key={key} style={{
              background: val !== '전체' ? `${bg}.06)` : 'rgba(255,255,255,.04)',
              border: `1px solid ${val !== '전체' ? `${bg}.25)` : 'rgba(255,255,255,.1)'}`,
              borderRadius: 12, padding: '10px 12px',
              transition: 'all .2s',
            }}>
              {/* 축 레이블 */}
              <div style={{
                fontSize: 9, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase',
                color: val !== '전체' ? color : 'rgba(255,255,255,.35)',
                marginBottom: 8, transition: 'color .2s',
              }}>{label}</div>

              {/* 3-way 토글: Left / 전체 / Right */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[left, '전체', right].map(opt => {
                  const isActive = val === opt
                  const isLeft   = opt === left
                  const isRight  = opt === right
                  const isCenter = opt === '전체'
                  return (
                    <button
                      key={opt}
                      onClick={() => onChange(condKey, isActive && !isCenter ? '전체' : opt)}
                      style={{
                        flex: isCenter ? 0.8 : 1,
                        padding: '6px 0',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: isActive
                          ? `1px solid ${bg}.5)`
                          : '1px solid rgba(255,255,255,.1)',
                        background: isActive
                          ? (isCenter ? 'rgba(255,255,255,.07)' : `${bg}.22)`)
                          : 'transparent',
                        color: isActive
                          ? (isCenter ? 'rgba(255,255,255,.5)' : color)
                          : 'rgba(255,255,255,.3)',
                        fontFamily: "'Black Han Sans', sans-serif",
                        fontSize: isCenter ? 9 : 13,
                        fontWeight: 700,
                        letterSpacing: isCenter ? 0.5 : 1,
                        transition: 'all .15s',
                        boxShadow: isActive && !isCenter ? `0 0 10px ${bg}.3)` : 'none',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 1,
                        lineHeight: 1,
                      }}
                    >
                      <span>{opt}</span>
                      {(isLeft || isRight) && (
                        <span style={{ fontSize: 8, opacity: 0.7, fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 400 }}>
                          {isLeft ? leftKo : rightKo}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

export default function ConditionPage({ onStart, onBack, celebrities }) {
  const [cond, setCond] = useState(DEFAULT)
  const matched = filterCelebs(cond, celebrities)
  const enough = matched.length >= 2

  const bracketSize = (() => {
    const n = Math.min(matched.length, 32)
    const sizes = [2, 4, 8, 16, 32]
    return sizes.find(s => s >= n) || 2
  })()

  const handleStart = () => {
    if (!enough) return
    // 랜덤 셔플 후 bracketSize명 선발
    const shuffled = [...matched].sort(() => Math.random() - 0.5)
    onStart(shuffled.slice(0, bracketSize))
  }

  return (
    <div style={{
      width: '100%', height: '100vh', overflowY: 'auto',
      background: '#1a0d38',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 20px 80px',
      fontFamily: "'Noto Sans KR', sans-serif",
      position: 'relative',
    }}>
      {/* 배경 그라디언트 */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(20,184,166,.35) 0%, transparent 55%)',
      }} />

      {/* 헤더 */}
      <div style={{
        width: '100%', maxWidth: 560, paddingTop: 28, paddingBottom: 12,
        display: 'flex', alignItems: 'center', gap: 14, zIndex: 1,
      }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: '50%', width: 40, height: 40, cursor: 'pointer',
          color: 'rgba(255,255,255,.4)', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'background .2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
        >←</button>

        <h2 style={{
          fontFamily: "'Black Han Sans', sans-serif",
          fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#fff', margin: 0,
        }}>이상형 조건 설정</h2>

        <div style={{
          marginLeft: 'auto', flexShrink: 0,
          background: enough ? 'rgba(20,184,166,.12)' : 'rgba(255,255,255,.05)',
          border: `1px solid ${enough ? 'rgba(20,184,166,.35)' : 'rgba(255,255,255,.08)'}`,
          borderRadius: 100, padding: '5px 14px',
          color: enough ? '#2dd4bf' : 'rgba(255,255,255,.25)',
          fontSize: 12, fontWeight: 700,
          transition: 'all .2s',
        }}>{matched.length}명 매칭</div>
      </div>

      {/* 메인 카드 */}
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'rgba(255,255,255,.13)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,.28)', borderRadius: 24,
        padding: 'clamp(20px,4vw,36px)', zIndex: 1,
      }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>성별</div>
          <ToggleGroup options={['전체', '여', '남']} value={cond.gender} onChange={v => setCond(p => ({ ...p, gender: v }))} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>국적</div>
          <ToggleGroup options={['전체', '한국', '해외']} value={cond.nationality} onChange={v => setCond(p => ({ ...p, nationality: v }))} />
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '4px 0 18px' }} />

        <RangeSlider label="키" unit="cm" min={150} max={195}
          valMin={cond.heightMin} valMax={cond.heightMax}
          onChange={(mn, mx) => setCond(p => ({ ...p, heightMin: mn, heightMax: mx }))} />
        <RangeSlider label="몸무게" unit="kg" min={40} max={90}
          valMin={cond.weightMin} valMax={cond.weightMax}
          onChange={(mn, mx) => setCond(p => ({ ...p, weightMin: mn, weightMax: mx }))} />
        <RangeSlider label="나이" unit="세" min={17} max={45}
          valMin={cond.ageMin} valMax={cond.ageMax}
          onChange={(mn, mx) => setCond(p => ({ ...p, ageMin: mn, ageMax: mx }))} />

        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '4px 0 18px' }} />

        {/* MBTI 필터 */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>MBTI</div>
          <MbtiFilter
            cond={cond}
            onChange={(key, val) => setCond(p => ({ ...p, [key]: val }))}
          />
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '18px 0 14px' }} />

        <div style={{ display: 'flex', gap: 10, marginTop: 0 }}>
          <button onClick={() => setCond(DEFAULT)} style={{
            flex: 1, padding: '14px', borderRadius: 12, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,.1)',
            background: 'transparent', color: 'rgba(255,255,255,.3)',
            fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13,
            transition: 'background .2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >초기화</button>

          <button onClick={handleStart} disabled={!enough} style={{
            flex: 3, padding: '14px', borderRadius: 12,
            cursor: enough ? 'pointer' : 'not-allowed', border: 'none',
            background: enough
              ? 'linear-gradient(90deg, #14b8a6, #22d3ee)'
              : 'rgba(255,255,255,.05)',
            color: enough ? '#042f2e' : 'rgba(255,255,255,.2)',
            fontFamily: "'Black Han Sans', sans-serif", fontSize: '1rem',
            boxShadow: enough ? '0 0 24px rgba(20,184,166,.4)' : 'none',
            transition: 'all .2s',
          }}>{enough ? `월드컵 시작! (${bracketSize}강)` : `조건 매칭 부족 (${matched.length}명)`}</button>
        </div>

        {/* 선발 기준 안내 */}
        {enough && matched.length > bracketSize && (
          <div style={{
            marginTop: 12, padding: '9px 14px', borderRadius: 10,
            background: 'rgba(20,184,166,.06)', border: '1px solid rgba(20,184,166,.15)',
            color: 'rgba(20,184,166,.7)', fontSize: 11, lineHeight: 1.5,
          }}>
            ✦ 매칭된 <b>{matched.length}명</b> 중 <b>{bracketSize}명</b>이 랜덤으로 선발돼요.
            매번 다른 대진표가 만들어집니다.
          </div>
        )}
      </div>

      {/* 매칭 미리보기 */}
      {matched.length > 0 && (
        <div style={{
          width: '100%', maxWidth: 560, marginTop: 14,
          background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 16, padding: '14px 18px', zIndex: 1,
        }}>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
            매칭된 연예인 ({matched.length}명 중 {bracketSize}명 선발)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {matched.slice(0, 16).map(c => (
              <div key={c.id} style={{
                background: 'rgba(20,184,166,.07)', border: '1px solid rgba(20,184,166,.18)',
                borderRadius: 100, padding: '4px 12px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 13 }}>{c.emoji}</span>
                <span style={{ color: 'rgba(255,255,255,.85)', fontSize: 12, fontWeight: 700 }}>{c.name}</span>
              </div>
            ))}
            {matched.length > 16 && (
              <div style={{
                background: 'rgba(255,255,255,.04)', borderRadius: 100,
                padding: '4px 12px', color: 'rgba(255,255,255,.25)', fontSize: 12,
              }}>+{matched.length - 16}</div>
            )}
          </div>
        </div>
      )}

      <style>{`input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;}`}</style>
    </div>
  )
}
