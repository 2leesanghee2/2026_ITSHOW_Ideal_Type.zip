import React from 'react'

export default function WelcomePage({ onStart }) {
  return (
    <div style={{
      width: '100%', height: '100vh',
      background: '#1a0d38',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {/* 배경 오브 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', width: 800, height: 800, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,.65) 0%, transparent 65%)',
          top: -300, left: '50%', transform: 'translateX(-50%)',
          animation: 'orb1 7s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,72,153,.55) 0%, transparent 70%)',
          bottom: -150, left: -80,
          animation: 'orb2 9s ease-in-out infinite 1.5s',
        }} />
        <div style={{
          position: 'absolute', width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,211,238,.5) 0%, transparent 70%)',
          bottom: -80, right: -60,
          animation: 'orb2 6s ease-in-out infinite 3s',
        }} />

        {/* 상단 네온 라인 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(139,92,246,.7), rgba(34,211,238,.7), rgba(236,72,153,.7), transparent)',
        }} />
        {/* 하단 스테이지 라인 */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,.8) 30%, rgba(34,211,238,.8) 70%, transparent 95%)',
          boxShadow: '0 0 24px rgba(139,92,246,.5)',
        }} />

        {/* 격자 패턴 */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(167,139,250,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,.18) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />
      </div>

      {/* ITSHOW 뱃지 */}
      <div style={{
        position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(139,92,246,.3)', border: '1px solid rgba(139,92,246,.65)',
        borderRadius: 100, padding: '6px 22px',
        color: '#e4b4ff', fontSize: 11, fontWeight: 700, letterSpacing: 3,
        whiteSpace: 'nowrap', zIndex: 1,
        animation: 'fadeIn .6s ease both',
      }}>✦ &nbsp; ITSHOW 2026 &nbsp; ✦</div>

      {/* 메인 콘텐츠 */}
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>

        {/* 타이틀 */}
        <h1 style={{
          fontFamily: "'Black Han Sans', sans-serif",
          fontSize: 'clamp(4.5rem, 14vw, 9rem)',
          lineHeight: 1.1, letterSpacing: '-3px', margin: 0,
          padding: '0.1em 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #e879f9 40%, #22d3ee 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          filter: 'drop-shadow(0 0 60px rgba(139,92,246,1)) drop-shadow(0 0 120px rgba(236,72,153,.6))',
          animation: 'fadeUp .7s .1s ease both',
        }}>이상형.zip</h1>

        <p style={{
          color: 'rgba(255,255,255,.7)',
          fontSize: 'clamp(1rem, 2.2vw, 1.3rem)',
          marginTop: 18, marginBottom: 52, letterSpacing: 2,
          animation: 'fadeUp .7s .25s ease both',
        }}>손 제스처로 나만의 이상형 월드컵</p>

        {/* CTA 버튼 */}
        <button
          onClick={onStart}
          style={{
            background: 'linear-gradient(135deg, #9333ea, #ec4899)',
            color: '#fff', border: 'none', borderRadius: 100,
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
            padding: 'clamp(18px,3vw,24px) clamp(60px,9vw,96px)',
            cursor: 'pointer',
            boxShadow: '0 0 40px rgba(147,51,234,.8), 0 0 80px rgba(147,51,234,.5), 0 0 140px rgba(236,72,153,.3)',
            animation: 'fadeUp .7s .4s ease both, ctaPulse 2.5s 1.1s ease-in-out infinite',
            transition: 'transform .2s',
            letterSpacing: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.07)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >시작하기 →</button>
      </div>

      {/* 하단 하우투 */}
      <div style={{
        position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 'clamp(28px,5vw,60px)', zIndex: 1,
        animation: 'fadeIn 1s .7s ease both',
      }}>
        {[
          { icon: '📷', label: '카메라 허용' },
          { icon: '🤚', label: '손을 콕!' },
          { icon: '🏆', label: '이상형 확정!' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>{s.icon}</div>
            <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 11, letterSpacing: 1 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes orb1 { 0%,100%{transform:translateX(-50%) scale(1)} 50%{transform:translateX(-50%) scale(1.1)} }
        @keyframes orb2 { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        @keyframes ctaPulse {
          0%,100%{box-shadow:0 0 40px rgba(147,51,234,.8),0 0 80px rgba(147,51,234,.5)}
          50%{box-shadow:0 0 70px rgba(147,51,234,1),0 0 140px rgba(147,51,234,.6),0 0 200px rgba(236,72,153,.4)}
        }
      `}</style>
    </div>
  )
}
