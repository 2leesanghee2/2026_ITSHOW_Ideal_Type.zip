import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useGestureCamera } from './useGestureCamera'

function playTone(freq = 440, dur = 120, vol = 0.2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000)
    osc.start()
    osc.stop(ctx.currentTime + dur / 1000)
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
  if (size >= 16) return '16강'
  if (size >= 8)  return '8강'
  if (size >= 4)  return '4강'
  return '결승'   // size === 2
}

function makeBracket(pool) {
  // pool은 ConditionPage에서 이미 정확한 수로 전달됨 (랜덤 셔플 완료)
  // 단, 2의 제곱수가 아닐 경우 올림 처리
  const sizes = [2, 4, 8, 16, 32]
  const size = sizes.find(s => s >= pool.length) || 2
  const shuffled = shuffle(pool)
  while (shuffled.length < size) shuffled.push(...shuffle(pool))
  return shuffled.slice(0, size)
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
  const [t, setT] = useState(() => initTournament(pool))
  const [highlight, setHighlight] = useState(null)
  const [flash, setFlash] = useState(null)
  const lastBeepPct = useRef(0)
  const isMountedRef = useRef(true)

  // 언마운트 시 플래그 해제 → setTimeout 콜백에서 setT 방지
  useEffect(() => { return () => { isMountedRef.current = false } }, [])

  // picking을 ref로 관리 → pick이 절대 재생성되지 않음
  // (재생성되면 MediaPipe onResults가 stale closure를 계속 참조해서 오작동)
  const pickingRef = useRef(false)

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

  // 의존성 없음 → 컴포넌트 생애 동안 동일한 함수 참조 유지
  const pick = useCallback((side) => {
    if (pickingRef.current) return
    if (tRef.current.done) return   // 우승자 확정 후 추가 입력 차단
    pickingRef.current = true
    setHighlight(side)
    const isFinal = tRef.current.currentRound.length === 2
    const winner  = side === 'left' ? leftRef.current : rightRef.current
    setFlash({ celeb: winner, side, isFinal })
    playTone(880, 180, 0.3)
    // 제스처 발동 → 타이머 리셋
    onActivity?.()

    setTimeout(() => {
      if (!isMountedRef.current) return
      setHighlight(null)
      pickingRef.current = false
      // 결승이 아닐 때만 즉시 플래시 클리어 — 결승은 onFinish 딜레이 후 클리어
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
  }, [])

  // onFinish를 ref로 참조 — onFinish 레퍼런스 변경 시 재트리거 방지
  // 우승자 확정 후 1.5초 유지하며 플래시 화면 보여준 뒤 결과 페이지로 이동
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
  const { videoRef, canvasRef, camState, gestureState, startCamera } = useGestureCamera({ onGesture: handleGesture, active: true })

  // 제스처 진행도 비프음
  const { dir: gDir, pct: gPct } = gestureState
  useEffect(() => {
    if (gDir && gPct > 0 && gPct > lastBeepPct.current + 35) {
      playTone(600 + gPct * 2.5, 50, 0.08)
      lastBeepPct.current = gPct
    }
    if (!gDir) lastBeepPct.current = 0
  }, [gDir, gPct])

  if (!left || !right) return null

  const leftGlow  = gDir === 'left'  ? gPct / 100 : highlight === 'left'  ? 1 : 0
  const rightGlow = gDir === 'right' ? gPct / 100 : highlight === 'right' ? 1 : 0

  const camColor = camState === 'ready' ? '#4ade80' : camState === 'loading' ? '#facc15' : '#ef4444'

  return (
    <div style={{
      width: '100%', height: '100vh', background: '#1a0d38',
      display: 'flex', position: 'relative', overflow: 'hidden',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {/* 최상단 진행 바 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,.06)', zIndex: 10 }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'linear-gradient(90deg, #8b5cf6, #22d3ee)',
          transition: 'width .5s ease',
          boxShadow: '0 0 10px rgba(139,92,246,.9)',
        }} />
      </div>

      {/* 라운드 뱃지 — 상단 중앙 */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
        background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)',
        borderRadius: 100, padding: '4px 18px',
        color: 'rgba(255,255,255,.95)', fontSize: 12, fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap',
      }}>⚔️ {stageLabel} &nbsp;{matchInStage} / {totalInStage}</div>

      {/* 카메라 PiP — 우상단 */}
      <div style={{
        position: 'absolute', top: 14, right: 14, width: 160, height: 120,
        borderRadius: 10, overflow: 'hidden', zIndex: 20,
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

      {/* 왼쪽 패널 */}
      <PanelSide
        key={`L-${left.id}`}
        celeb={left} side="left" glow={leftGlow} highlighted={highlight === 'left'}
        onClick={() => pick('left')}
      />

      {/* 중앙 VS */}
      <div style={{
        width: 'clamp(44px,5vw,68px)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.5)', position: 'relative', zIndex: 5,
      }}>
        <div style={{
          fontFamily: "'Black Han Sans', sans-serif",
          fontSize: 'clamp(.9rem,2vw,1.5rem)',
          color: 'rgba(255,255,255,.45)', letterSpacing: 2,
        }}>VS</div>
      </div>

      {/* 오른쪽 패널 */}
      <PanelSide
        key={`R-${right.id}`}
        celeb={right} side="right" glow={rightGlow} highlighted={highlight === 'right'}
        onClick={() => pick('right')}
      />

      {/* 제스처 미터 — 하단 */}
      <GestureMeter gestureState={gestureState} camState={camState} />

      {/* 선택 시 풀스크린 확장 */}
      {flash && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          animation: flash.side === 'left'
            ? 'expandLeft .42s cubic-bezier(.4,0,.2,1) both'
            : 'expandRight .42s cubic-bezier(.4,0,.2,1) both',
        }}>
          <PanelSide celeb={flash.celeb} side={flash.side} glow={1} highlighted={true} onClick={() => {}} fullscreen />
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            color: flash.side === 'left' ? '#c4b5fd' : '#fbcfe8',
            fontFamily: "'Black Han Sans', sans-serif",
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
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes expandLeft  { from{clip-path:inset(0 50% 0 0)} to{clip-path:inset(0 0% 0 0)} }
        @keyframes expandRight { from{clip-path:inset(0 0 0 50%)} to{clip-path:inset(0 0% 0 0)} }
        @keyframes popIn { from{opacity:0;transform:translate(-50%,-50%) scale(.5)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>
    </div>
  )
}

function PanelSide({ celeb, side, glow, highlighted, onClick, fullscreen }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const isLeft  = side === 'left'
  const color   = isLeft ? '139,92,246' : '236,72,153'
  const showImg = celeb.image && !failed

  return (
    <div
      onClick={onClick}
      style={{
        ...(fullscreen ? { position: 'absolute', inset: 0 } : { flex: 1 }),
        overflow: 'hidden', cursor: fullscreen ? 'default' : 'pointer',
        background: '#1e1040',
        transform: `scale(${
          fullscreen ? 1 :
          highlighted ? 1.04 :
          glow > 0    ? 1 + glow * 0.06 :
          1
        })`,
        transformOrigin: fullscreen ? 'center' : (isLeft ? 'left center' : 'right center'),
        transition: highlighted ? 'transform .25s cubic-bezier(.34,1.56,.64,1)' : 'transform .06s linear',
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
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: '50% 15%',
            opacity: loaded ? 1 : 0, transition: 'opacity .5s',
          }}
        />
      ) : (
        /* 이미지 없을 때 이모지 배경 */
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `radial-gradient(ellipse at center, rgba(${color},.55) 0%, #1e1040 70%)`,
          fontSize: 'clamp(80px,18vw,160px)',
        }}>{celeb.emoji}</div>
      )}

      {/* 이미지 로딩 중 플레이스홀더 */}
      {showImg && !loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'clamp(60px,14vw,120px)',
          background: `radial-gradient(ellipse at 50% 30%, rgba(${color},.35) 0%, #1e1040 70%)`,
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}>{celeb.emoji}</div>
      )}

      {/* 컬러 오버레이 (제스처/하이라이트) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: isLeft
          ? `linear-gradient(to right, rgba(${color},${0.15 + glow * 0.35}) 0%, transparent 60%)`
          : `linear-gradient(to left,  rgba(${color},${0.15 + glow * 0.35}) 0%, transparent 60%)`,
        transition: 'background .1s',
      }} />

      {/* 하단 그라디언트 (이름 가독성) */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '55%', pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.5) 50%, transparent 100%)',
      }} />

      {/* 엣지 네온 */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, width: 4,
        [isLeft ? 'left' : 'right']: 0,
        background: `rgba(${color},${0.3 + glow * 0.7})`,
        boxShadow: `${isLeft ? '' : '-'}6px 0 28px rgba(${color},${0.2 + glow * 0.6})`,
        transition: 'all .1s',
      }} />

      {/* 화살표 */}
      {!fullscreen && (
        <div style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          [isLeft ? 'left' : 'right']: 'clamp(12px,2.5vw,28px)',
          color: `rgba(${color},${0.15 + glow * 0.75})`,
          fontSize: 'clamp(2rem,5vw,4rem)', fontWeight: 900,
          userSelect: 'none', transition: 'color .1s', lineHeight: 1,
        }}>{isLeft ? '←' : '→'}</div>
      )}

      {/* 하이라이트 테두리 */}
      {highlighted && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: `inset 0 0 0 3px rgba(${color},.8)`,
        }} />
      )}

      {/* 이름 + 정보 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 'clamp(16px,3vw,28px)',
        paddingBottom: fullscreen ? 'clamp(16px,3vw,28px)' : 'clamp(56px,8vh,90px)',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'Black Han Sans', sans-serif",
          fontSize: highlighted || fullscreen ? 'clamp(2rem,5vw,3.5rem)' : 'clamp(1.6rem,4vw,2.8rem)',
          color: '#fff',
          textShadow: `0 0 ${highlighted ? 40 : 16}px rgba(${color},${highlighted ? .9 : .4})`,
          lineHeight: 1.1, transition: 'all .2s',
        }}>{celeb.name}</div>
        <div style={{
          color: 'rgba(255,255,255,.45)', fontSize: 'clamp(.7rem,1.3vw,.9rem)',
          marginTop: 6, display: 'flex', justifyContent: 'center',
          alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          {celeb.group && <span>{celeb.group}</span>}
          {celeb.group && celeb.mbti && <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>}
          {celeb.mbti && <span>{celeb.mbti}</span>}
          {celeb.age > 0 && <><span style={{ color: 'rgba(255,255,255,.15)' }}>·</span><span>{celeb.age}세</span></>}
        </div>
      </div>
    </div>
  )
}

function GestureMeter({ gestureState, camState }) {
  const { dir, pct } = gestureState

  let text
  if (camState === 'loading') text = '⏳ 카메라 연결 중...'
  else if (camState === 'noperm' || camState === 'error') text = '카드를 직접 탭해서 선택하세요'
  else if (!dir) text = '손을 ← 또는 → 방향으로 스윙하세요'
  else if (dir === 'left') text = `← 왼쪽 ${pct}%`
  else text = `오른쪽 → ${pct}%`

  const barColor = dir === 'left' ? '#8b5cf6' : '#ec4899'
  const isIdle   = camState === 'ready' && !dir

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      zIndex: 10, width: 'clamp(200px,40vw,320px)',
    }}>
      <div style={{
        color: dir ? '#fff' : 'rgba(255,255,255,.5)',
        fontSize: 13, fontWeight: 700, letterSpacing: 1, textAlign: 'center',
        transition: 'color .2s',
        animation: isIdle ? 'blink 2.8s ease-in-out infinite' : 'none',
      }}>{text}</div>

      <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        {dir === 'left' && (
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`,
            background: `linear-gradient(90deg, #6d28d9, ${barColor})`,
            borderRadius: 3, transition: 'width .08s',
            boxShadow: `0 0 8px ${barColor}`,
          }} />
        )}
        {dir === 'right' && (
          <div style={{
            position: 'absolute', right: 0, top: 0, height: '100%', width: `${pct}%`,
            background: `linear-gradient(270deg, #9d174d, ${barColor})`,
            borderRadius: 3, transition: 'width .08s',
            boxShadow: `0 0 8px ${barColor}`,
          }} />
        )}
      </div>
    </div>
  )
}
