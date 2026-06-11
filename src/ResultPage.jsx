import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

function useConfetti(ref) {
  useEffect(() => {
    const container = ref.current
    if (!container) return
    container.innerHTML = ''
    const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#ec4899', '#a855f7', '#ffffff', '#34d399', '#60a5fa']
    for (let i = 0; i < 90; i++) {
      const el = document.createElement('div')
      const color = colors[Math.floor(Math.random() * colors.length)]
      const size  = 5 + Math.random() * 9
      el.style.cssText = `
        position:absolute;
        left:${Math.random() * 100}%;
        top:-20px;
        width:${size}px; height:${size}px;
        background:${color};
        border-radius:${Math.random() > .5 ? '50%' : '3px'};
        animation:confettiFall ${1.8 + Math.random() * 2.4}s ${Math.random() * 2.2}s linear forwards;
        opacity:${.6 + Math.random() * .4};
        pointer-events:none;
      `
      container.appendChild(el)
    }
  }, [])
}

function WinnerAvatar({ winner, size }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showImg = winner.image && !failed

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: '3px solid rgba(251,191,36,.85)',
      boxShadow: '0 0 40px rgba(251,191,36,.7), 0 0 100px rgba(251,191,36,.4)',
      overflow: 'hidden', position: 'relative', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: showImg && !loaded ? 'rgba(255,255,255,.06)' : '#110e2a',
    }}>
      <span style={{
        position: 'absolute', fontSize: size * 0.42,
        opacity: showImg && loaded ? 0 : 1, transition: 'opacity .3s',
      }}>{winner.emoji}</span>
      {showImg && (
        <img src={winner.image} alt={winner.name}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'top',
            opacity: loaded ? 1 : 0, transition: 'opacity .5s',
          }} />
      )}
    </div>
  )
}

export default function ResultPage({ winner, onRetry, onLeaderboard }) {
  const confettiRef = useRef(null)
  useConfetti(confettiRef)

  const bracketSize = winner?.bracketSize || 16
  const score = Math.round(((bracketSize - 1) / bracketSize) * 1000) / 10

  const [nickname, setNickname] = useState('')
  const [message, setMessage]   = useState('')
  const [saving, setSaving]     = useState(false)

  const canSubmit = nickname.trim().length > 0

  const [submitError, setSubmitError] = useState('')

  const handleLeaderboard = async () => {
    if (saving || !canSubmit) return
    const name = nickname.trim()
    setSaving(true)
    setSubmitError('')
    try {
      if (supabase) {
        const { error } = await supabase.from('scores').insert({
          player:       name,
          celeb_name:   winner.name,
          celeb_emoji:  winner.emoji || '',
          celeb_group:  winner.group || '',
          points:       Math.round(score * 100),
          bracket_size: bracketSize,
          message:      message.trim() || null,
        })
        if (error) throw error
      }
      onLeaderboard(name)
    } catch (e) {
      console.error('방명록 저장 실패:', e)
      setSubmitError('저장에 실패했어요. 다시 시도해주세요.')
      setSaving(false)
    }
  }

  return (
    <div style={{
      width: '100%', height: '100vh', background: '#1a0d38',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 35%, rgba(251,191,36,.35) 0%, transparent 55%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(251,191,36,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,.1) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
      }} />

      <div ref={confettiRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* 트로피 */}
      <div style={{
        fontSize: 'clamp(2rem,5vw,3.5rem)', zIndex: 1, lineHeight: 1,
        animation: 'trophyBounce 3.5s ease-in-out infinite',
        filter: 'drop-shadow(0 0 30px rgba(251,191,36,1)) drop-shadow(0 0 60px rgba(251,191,36,.6))',
        marginBottom: 10,
      }}>🏆</div>

      {/* 우승자 이미지 */}
      <div style={{ zIndex: 1, animation: 'fadeUp .5s .05s ease both' }}>
        <WinnerAvatar winner={winner} size={160} />
      </div>

      {/* 라벨 */}
      <div style={{
        color: 'rgba(255,255,255,.6)', fontSize: 'clamp(.75rem,1.6vw,.9rem)',
        letterSpacing: 4, fontWeight: 700, marginTop: 14, zIndex: 1,
        animation: 'fadeUp .6s .1s ease both', textTransform: 'uppercase',
      }}>당신의 이상형 No.1</div>

      {/* 우승자 이름 */}
      <div style={{
        fontFamily: "'Black Han Sans', sans-serif",
        fontSize: 'clamp(2.2rem,7vw,4.5rem)',
        background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 45%, #ffffff 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        filter: 'drop-shadow(0 0 40px rgba(251,191,36,.9)) drop-shadow(0 0 80px rgba(251,191,36,.5))',
        zIndex: 1, marginTop: 6, lineHeight: 1.05,
        animation: 'fadeUp .6s .2s ease both', textAlign: 'center',
      }}>
        {winner?.name}
      </div>

      {/* 그룹 · MBTI · 배지 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, zIndex: 1,
        animation: 'fadeUp .6s .25s ease both', flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {winner?.group && <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>{winner.group}</span>}
        {winner?.group && winner?.mbti && <span style={{ color: 'rgba(255,255,255,.3)' }}>·</span>}
        {winner?.mbti && <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>{winner.mbti}</span>}
        <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
        <span style={{
          background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.28)',
          borderRadius: 100, padding: '3px 12px',
          color: '#fbbf24', fontSize: 11, fontWeight: 700,
        }}>상위 {(100 - score).toFixed(1)}%</span>
      </div>

      {/* 호감도 바 */}
      <div style={{
        width: 'clamp(200px,50vw,340px)', marginTop: 20, zIndex: 1,
        animation: 'fadeUp .6s .3s ease both',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>호감도</span>
          <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>{score}%</span>
        </div>
        <div style={{ height: 7, background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${score}%`,
            background: 'linear-gradient(90deg, #d97706, #fbbf24, #fde68a)',
            borderRadius: 4, boxShadow: '0 0 12px rgba(251,191,36,.6)',
            animation: 'barGrow .9s .7s ease both',
          }} />
        </div>
      </div>

      {/* 닉네임 입력 + 버튼 */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8, marginTop: 22,
        width: 'clamp(240px,55vw,360px)', zIndex: 1,
        animation: 'fadeUp .6s .4s ease both',
      }}>
        <input
          type="text"
          maxLength={12}
          placeholder="닉네임 (최대 12자)"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          style={{
            width: '100%', padding: '11px 16px', borderRadius: 10, boxSizing: 'border-box',
            border: '1px solid rgba(251,191,36,.25)',
            background: 'rgba(251,191,36,.05)',
            color: '#fff', fontSize: 14,
            fontFamily: "'Noto Sans KR', sans-serif", outline: 'none',
          }}
        />

        <textarea
          maxLength={80}
          placeholder={`${winner?.name}이(가) 이상형인 이유... (선택)`}
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
          style={{
            width: '100%', padding: '11px 16px', borderRadius: 10, boxSizing: 'border-box',
            border: '1px solid rgba(251,191,36,.25)',
            background: 'rgba(251,191,36,.05)',
            color: '#fff', fontSize: 13, resize: 'none',
            fontFamily: "'Noto Sans KR', sans-serif", outline: 'none',
          }}
        />

        {submitError && (
          <div style={{
            padding: '8px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
            color: '#fca5a5', fontSize: 12, textAlign: 'center',
          }}>{submitError}</div>
        )}

        <button
          onClick={handleLeaderboard}
          disabled={saving || !canSubmit}
          style={{
            padding: '14px', border: 'none', borderRadius: 12,
            cursor: (saving || !canSubmit) ? 'not-allowed' : 'pointer',
            background: (saving || !canSubmit)
              ? 'rgba(255,255,255,.07)'
              : 'linear-gradient(135deg, #d97706, #fbbf24)',
            color: (saving || !canSubmit) ? 'rgba(255,255,255,.2)' : '#422006',
            fontFamily: "'Black Han Sans', sans-serif", fontSize: '1rem',
            boxShadow: (saving || !canSubmit) ? 'none' : '0 0 24px rgba(251,191,36,.4)',
            transition: 'all .2s',
          }}
        >{saving ? '등록 중...' : !canSubmit ? '닉네임을 입력해주세요' : '💌 방명록 남기기'}</button>

        <button
          onClick={onRetry}
          style={{
            padding: '13px', borderRadius: 12, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.4)',
            fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13,
            transition: 'background .2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
        >다시하기</button>
      </div>

      <style>{`
        @keyframes trophyBounce { 0%,100%{transform:translateY(0) rotate(-6deg)} 50%{transform:translateY(-12px) rotate(6deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes barGrow { from{width:0} to{width:${score}%} }
        @keyframes confettiFall { to{transform:translateY(110vh) rotate(720deg);opacity:0} }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,.2); }
        input:focus, textarea:focus { border-color: rgba(251,191,36,.6) !important; background: rgba(251,191,36,.1) !important; }
      `}</style>
    </div>
  )
}
