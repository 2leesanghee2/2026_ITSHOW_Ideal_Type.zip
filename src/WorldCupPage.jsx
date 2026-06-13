import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useGestureCamera } from './useGestureCamera'

function playTone(freq = 440, dur = 120, vol = 0.2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000)
    osc.start()
    osc.stop(ctx.currentTime + dur / 1000)
    osc.onended = () => ctx.close()
  } catch (e) {}
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getStageLabel(size) {
  if (size >= 32) return '32강'
  if (size >= 16) return '16강'
  if (size >= 8)  return '8강'
  if (size >= 4)  return '4강'
  return '결승'
}

function makeBracket(pool) {
  const sizes = [32, 16, 8, 4, 2]
  const size = sizes.find(s => s <= pool.length) || 2
  return shuffle(pool).slice(0, size)
}

function initTournament(pool) {
  const bracket = makeBracket(pool)
  return {
    bracketSize: bracket.length,
    currentRound: bracket,
    matchIndex: 0,
    winners: [],
    totalMatches: 0,
    totalNeeded: bracket.length - 1,
    done: false,
    champion: null,
  }
}

export default function WorldCupPage({ pool, onFinish, onActivity }) {
  const [t, setT]           = useState(() => initTournament(pool))
  const [highlight, setHighlight] = useState(null)   // 'left' | 'right'
  const [flash, setFlash]   = useState(null)
  const [slide, setSlide]   = useState(0)            // 0 = 왼쪽 후보, 1 = 오른쪽 후보
  const lastBeepPct         = useRef(0)
  const isMountedRef        = useRef(true)
  const slideTimerRef       = useRef(null)
  const pickingRef          = useRef(false)

  useEffect(() => { return () => { isMountedRef.current = false } }, [])

  const left  = t.currentRound[t.matchIndex * 2]
  const right = t.currentRound[t.matchIndex * 2 + 1]
  const stageLabel   = getStageLabel(t.currentRound.length)
  const matchInStage = t.matchIndex + 1
  const totalInStage = Math.floor(t.currentRound.length / 2)
  const progress     = Math.round((t.totalMatches / (t.totalNeeded || 1)) * 100)

  const leftRef      = useRef(left)
  const rightRef     = useRef(right)
  const tRef         = useRef(t)
  const onFinishRef  = useRef(onFinish)
  useEffect(() => { leftRef.current = left; rightRef.current = right }, [left, right])
  useEffect(() => { tRef.current = t }, [t])
  useEffect(() => { onFinishRef.current = onFinish }, [onFinish])

  // ── 자동 슬라이드 (왔다갔다) ──────────────────────────────────────
  const startSlideTimer = useCallback(() => {
    clearInterval(slideTimerRef.current)
    slideTimerRef.current = setInterval(() => {
      setSlide(s => s === 0 ? 1 : 0)
    }, 2800)
  }, [])

  useEffect(() => {
    startSlideTimer()
    return () => clearInterval(slideTimerRef.current)
  }, [startSlideTimer, t.matchIndex])

  // 매치 바뀔 때 슬라이드 0으로 리셋
  useEffect(() => {
    setSlide(0)
  }, [t.matchIndex])

  const pick = useCallback((side) => {
    if (pickingRef.current) return
    if (tRef.current.done) return
    pickingRef.current = true
    clearInterval(slideTimerRef.current)
    setHighlight(side)
    const isFinal = tRef.current.currentRound.length === 2
    const winner  = side === 'left' ? leftRef.current : rightRef.current
    setFlash({ celeb: winner, side, isFinal })
    playTone(880, 180, 0.3)
    onActivity?.()

    setTimeout(() => {
      if (!isMountedRef.current) return
      setHighlight(null)
      pickingRef.current = false
      if (!isFinal) setFlash(null)
      setT(prev => {
        const w = side === 'left'
          ? prev.currentRound[prev.matchIndex * 2]
          : prev.currentRound[prev.matchIndex * 2 + 1]
        const newWinners   = [...prev.winners, w]
        const newTotal     = prev.totalMatches + 1
        const stageMatches = Math.floor(prev.currentRound.length / 2)
        const roundDone    = newWinners.length >= stageMatches
        if (roundDone) {
          if (newWinners.length === 1) {
            return { ...prev, totalMatches: newTotal, done: true, champion: { ...newWinners[0], bracketSize: prev.bracketSize } }
          }
          return { ...prev, currentRound: newWinners, matchIndex: 0, winners: [], totalMatches: newTotal }
        }
        return { ...prev, matchIndex: prev.matchIndex + 1, winners: newWinners, totalMatches: newTotal }
      })
    }, 650)
  }, [onActivity, startSlideTimer])

  useEffect(() => {
    if (!t.done || !t.champion) return
    const champ = t.champion
    const tid = setTimeout(() => {
      if (!isMountedRef.current) return
      setFlash(null)
      onFinishRef.current(champ)
    }, 1500)
    return () => clearTimeout(tid)
  }, [t.done, t.champion])

  const handleGesture = useCallback((dir) => { pick(dir) }, [pick])
  const { videoRef, canvasRef, camState, gestureState, handZone, startCamera } =
    useGestureCamera({ onGesture: handleGesture, active: true })

  const { dir: gDir, pct: gPct } = gestureState
  useEffect(() => {
    if (gDir && gPct > 0 && gPct > lastBeepPct.current + 35) {
      playTone(600 + gPct * 2.5, 50, 0.08)
      lastBeepPct.current = gPct
    }
    if (!gDir) lastBeepPct.current = 0
  }, [gDir, gPct])

  if (!left || !right) return null

  const camColor = camState === 'ready' ? '#4ade80' : camState === 'loading' ? '#facc15' : '#ef4444'

  const currentCeleb = slide === 0 ? left : right
  const otherCeleb   = slide === 0 ? right : left
  const currentSide  = slide === 0 ? 'left' : 'right'
  const otherSide    = slide === 0 ? 'right' : 'left'
  const color        = currentSide === 'left' ? '139,92,246' : '236,72,153'
  const otherColor   = currentSide === 'left' ? '236,72,153' : '139,92,246'

  const isHighlighted = highlight === currentSide
  const glow = gDir === currentSide ? gPct / 100 : isHighlighted ? 1 : 0

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0d0720',
      overflow: 'hidden', position: 'relative',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {/* 진행 바 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,.06)', zIndex: 30 }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)',
          transition: 'width .5s', boxShadow: '0 0 10px rgba(139,92,246,.9)',
        }} />
      </div>

      {/* ── 풀스크린 슬라이드 컨테이너 ── */}
      <div style={{
        display: 'flex', width: '200%', height: '100%',
        transform: `translateX(${slide === 0 ? 0 : -50}%)`,
        transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {[left, right].map((celeb, idx) => (
          <CelebCard
            key={`${celeb?.id}-${idx}`}
            celeb={celeb}
            side={idx === 0 ? 'left' : 'right'}
            glow={gDir === (idx === 0 ? 'left' : 'right') ? gPct / 100 : highlight === (idx === 0 ? 'left' : 'right') ? 1 : 0}
            highlighted={highlight === (idx === 0 ? 'left' : 'right')}
            onClick={() => pick(idx === 0 ? 'left' : 'right')}
          />
        ))}
      </div>

      {/* ── 상단 HUD ── */}
      <div style={{
        position: 'absolute', top: 12, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)',
          borderRadius: 100, padding: '4px 16px',
          color: 'rgba(255,255,255,.9)', fontSize: 11, fontWeight: 700, letterSpacing: 1,
        }}>⚔️ {stageLabel} &nbsp;{matchInStage} / {totalInStage}</div>
      </div>

      {/* ── 하단 VS + 후보 이름 표시 ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        padding: '0 24px 20px',
        background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        {/* 도트 인디케이터 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: i === slide ? 24 : 8, height: 8, borderRadius: 4,
              background: i === 0
                ? `rgba(139,92,246,${i === slide ? 1 : 0.35})`
                : `rgba(236,72,153,${i === slide ? 1 : 0.35})`,
              transition: 'all .4s',
            }} />
          ))}
        </div>

        {/* 양쪽 이름 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              flex: 1, textAlign: 'left', cursor: 'pointer', pointerEvents: 'auto',
              opacity: slide === 0 ? 1 : 0.4, transition: 'opacity .4s',
            }}
            onClick={() => pick('left')}
          >
            <div style={{
              fontFamily: "'Black Han Sans',sans-serif",
              fontSize: 'clamp(1.2rem,3vw,2rem)', color: '#c4b5fd',
              textShadow: '0 0 20px rgba(139,92,246,.7)',
            }}>{left?.name}</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 11 }}>{left?.group}</div>
          </div>

          <div style={{
            fontFamily: "'Black Han Sans',sans-serif",
            fontSize: 'clamp(1rem,2.5vw,1.6rem)',
            color: 'rgba(255,255,255,.3)', letterSpacing: 2, padding: '0 16px',
          }}>VS</div>

          <div
            style={{
              flex: 1, textAlign: 'right', cursor: 'pointer', pointerEvents: 'auto',
              opacity: slide === 1 ? 1 : 0.4, transition: 'opacity .4s',
            }}
            onClick={() => pick('right')}
          >
            <div style={{
              fontFamily: "'Black Han Sans',sans-serif",
              fontSize: 'clamp(1.2rem,3vw,2rem)', color: '#fbcfe8',
              textShadow: '0 0 20px rgba(236,72,153,.7)',
            }}>{right?.name}</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 11 }}>{right?.group}</div>
          </div>
        </div>

        {/* 제스처 미터 */}
        <GestureMeter gestureState={gestureState} camState={camState} handZone={handZone} />
      </div>

      {/* ── 카메라 PiP ── */}
      <div style={{
        position: 'absolute', top: 14, right: 14, width: 160, height: 120,
        borderRadius: 10, overflow: 'hidden', zIndex: 25,
        border: `1.5px solid ${camColor}44`,
        boxShadow: `0 0 14px ${camColor}33`,
      }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
          background: 'rgba(0,0,0,.6)', color: camColor, fontSize: 9, fontWeight: 700, padding: '3px 0',
        }}>
          {camState === 'ready' ? '손 인식 중' : camState === 'loading' ? '연결 중...' : '카메라 오류'}
        </div>
        {(camState === 'noperm' || camState === 'error') && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,.9)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 22 }}>📷</span>
            <button onClick={startCamera} style={{
              background: '#4ade80', color: '#052e16', border: 'none',
              padding: '4px 12px', borderRadius: 100, fontSize: 10, cursor: 'pointer', fontWeight: 700,
            }}>재시도</button>
          </div>
        )}
      </div>

      {/* ── 선택 시 풀스크린 확장 ── */}
      {flash && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <CelebCard celeb={flash.celeb} side={flash.side} glow={1} highlighted fullscreen />
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            color: flash.side === 'left' ? '#c4b5fd' : '#fbcfe8',
            fontFamily: "'Black Han Sans',sans-serif",
            fontSize: flash.isFinal ? 'clamp(3rem,9vw,6.5rem)' : 'clamp(2.5rem,7vw,5rem)',
            letterSpacing: 4, textShadow: '0 0 60px currentColor',
            animation: 'popIn .38s cubic-bezier(.34,1.56,.64,1) .1s both',
            textAlign: 'center', lineHeight: 1.2,
          }}>
            {flash.isFinal ? <>🏆<br/>우승!</> : '선택!'}
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn { from{opacity:0;transform:translate(-50%,-50%) scale(.5)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>
    </div>
  )
}

function CelebCard({ celeb, side, glow, highlighted, onClick, fullscreen }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const isLeft  = side === 'left'
  const color   = isLeft ? '139,92,246' : '236,72,153'
  const showImg = celeb?.image && !failed

  return (
    <div
      onClick={onClick}
      style={{
        width: '50%', height: '100%',
        flexShrink: 0,
        ...(fullscreen ? { position: 'absolute', inset: 0, width: '100%' } : {}),
        position: 'relative', overflow: 'hidden',
        cursor: fullscreen ? 'default' : 'pointer',
        background: '#1a0d38',
      }}
    >
      {/* 배경 이미지 */}
      {showImg ? (
        <img
          src={celeb.image}
          alt={celeb.name}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: '50% 15%',
            opacity: loaded ? 1 : 0, transition: 'opacity .5s',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `radial-gradient(ellipse at center, rgba(${color},.55) 0%, #1a0d38 70%)`,
          fontSize: 'clamp(80px,20vw,180px)',
        }}>{celeb?.emoji}</div>
      )}

      {showImg && !loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'clamp(60px,14vw,140px)',
          background: `radial-gradient(ellipse at 50% 30%, rgba(${color},.35) 0%, #1a0d38 70%)`,
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}>{celeb?.emoji}</div>
      )}

      {/* 컬러 오버레이 */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: isLeft
          ? `linear-gradient(to right, rgba(${color},${0.12 + glow * 0.3}) 0%, transparent 50%)`
          : `linear-gradient(to left, rgba(${color},${0.12 + glow * 0.3}) 0%, transparent 50%)`,
        transition: 'background .1s',
      }} />

      {/* 하단 그라디언트 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.3) 50%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* 엣지 네온 */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, width: 4,
        [isLeft ? 'left' : 'right']: 0,
        background: `rgba(${color},${0.25 + glow * 0.75})`,
        boxShadow: `${isLeft ? '' : '-'}8px 0 32px rgba(${color},${0.15 + glow * 0.6})`,
        transition: 'all .1s',
      }} />

      {highlighted && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: `inset 0 0 0 3px rgba(${color},.9)`,
        }} />
      )}
    </div>
  )
}

function GestureMeter({ gestureState, camState, handZone }) {
  const { dir, pct } = gestureState
  let text
  if (camState === 'loading') text = '⏳ 카메라 연결 중...'
  else if (camState === 'noperm' || camState === 'error') text = '카드를 직접 탭해서 선택하세요'
  else if (dir === 'left') text = '👈 선택!'
  else if (dir === 'right') text = '선택! 👉'
  else if (handZone === 'left') text = '👈 왼쪽 구역 인식됨'
  else if (handZone === 'right') text = '오른쪽 구역 인식됨 👉'
  else text = '손을 올려보세요 🤚'

  const barColor = dir === 'left' ? '#8b5cf6' : '#ec4899'
  const isIdle   = camState === 'ready' && !dir

  return (
    <div style={{
      marginTop: 14,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      <div style={{
        color: dir ? '#fff' : 'rgba(255,255,255,.5)',
        fontSize: 12, fontWeight: 700, letterSpacing: 1, textAlign: 'center',
        transition: 'color .2s',
        animation: isIdle ? 'blink 2.8s ease-in-out infinite' : 'none',
      }}>{text}</div>

      <div style={{ width: 240, height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        {dir === 'left' && (
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`,
            background: `linear-gradient(90deg,#6d28d9,${barColor})`,
            borderRadius: 2, transition: 'width .08s', boxShadow: `0 0 8px ${barColor}`,
          }} />
        )}
        {dir === 'right' && (
          <div style={{
            position: 'absolute', right: 0, top: 0, height: '100%', width: `${pct}%`,
            background: `linear-gradient(270deg,#9d174d,${barColor})`,
            borderRadius: 2, transition: 'width .08s', boxShadow: `0 0 8px ${barColor}`,
          }} />
        )}
      </div>
    </div>
  )
}
