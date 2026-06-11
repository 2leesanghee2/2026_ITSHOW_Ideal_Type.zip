import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export default function LeaderboardPage({ winner, nickname, onHome }) {
  const [entries, setEntries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [filter, setFilter]   = useState('all') // 'all' | 'same'
  const myName = nickname || '익명'

  useEffect(() => {
    if (!supabase) {
      setFetchError('오프라인 모드 — 방명록을 불러올 수 없어요.')
      setLoading(false)
      return
    }
    supabase
      .from('scores')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          console.error('방명록 로드 실패:', error)
          setFetchError('방명록을 불러오는 데 실패했어요.')
        } else if (data) {
          setEntries(data)
        }
        setLoading(false)
      })
  }, [])

  const filtered = filter === 'same'
    ? (entries ?? []).filter(e => e.celeb_name === winner?.name)
    : (entries ?? [])

  const sameCount = (entries ?? []).filter(e => e.celeb_name === winner?.name).length

  return (
    <div style={{
      width: '100%', height: '100vh', overflowY: 'auto',
      background: '#1a0d38',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 20px 80px',
      fontFamily: "'Noto Sans KR', sans-serif",
      position: 'relative',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(236,72,153,.35) 0%, transparent 55%)',
      }} />

      {/* 헤더 */}
      <div style={{
        width: '100%', maxWidth: 560, paddingTop: 32, marginBottom: 20, zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'fadeUp .5s ease both',
      }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 10 }}>💌</div>
        <h1 style={{
          fontFamily: "'Black Han Sans', sans-serif",
          fontSize: 'clamp(1.6rem,5vw,2.2rem)',
          margin: 0, textAlign: 'center',
          background: 'linear-gradient(135deg, #fff, #f9a8d4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>이상형 방명록</h1>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, margin: '6px 0 0', letterSpacing: 1 }}>
          {loading ? '불러오는 중...' : `총 ${entries?.length ?? 0}개의 기록`}
        </p>
      </div>

      {/* 필터 탭 */}
      {winner && (
        <div style={{
          width: '100%', maxWidth: 560, zIndex: 1, marginBottom: 14,
          display: 'flex', gap: 8,
          animation: 'fadeUp .5s .05s ease both',
        }}>
          <FilterTab
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="전체 방명록"
            count={entries?.length ?? 0}
            color="rgba(255,255,255,.6)"
            activeColor="#fff"
            activeBg="rgba(255,255,255,.08)"
          />
          <FilterTab
            active={filter === 'same'}
            onClick={() => setFilter('same')}
            label={`${winner.emoji} ${winner.name} 팬만`}
            count={sameCount}
            color="rgba(249,168,212,.6)"
            activeColor="#f9a8d4"
            activeBg="rgba(236,72,153,.1)"
            activeBorder="rgba(236,72,153,.3)"
          />
        </div>
      )}

      {/* 리스트 */}
      <div style={{ width: '100%', maxWidth: 560, zIndex: 1 }}>
        {loading && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.45)', padding: 40 }}>
            불러오는 중...
          </div>
        )}

        {fetchError && !loading && (
          <div style={{
            textAlign: 'center', padding: '20px', borderRadius: 12,
            background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
            color: 'rgba(252,165,165,.8)', fontSize: 13,
          }}>{fetchError}</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            color: 'rgba(255,255,255,.2)', fontSize: 14,
            border: '1px dashed rgba(255,255,255,.08)', borderRadius: 16,
          }}>
            {filter === 'same' ? `아직 ${winner?.name}을(를) 선택한 사람이 없어요` : '아직 방명록이 없어요'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((entry, i) => {
            const isMe = entry.player === myName
            const isSame = entry.celeb_name === winner?.name
            return (
              <div key={entry.id} style={{
                background: isMe
                  ? 'rgba(236,72,153,.07)'
                  : isSame && filter === 'all'
                    ? 'rgba(139,92,246,.05)'
                    : 'rgba(255,255,255,.03)',
                border: `1px solid ${
                  isMe ? 'rgba(236,72,153,.25)'
                  : isSame && filter === 'all' ? 'rgba(139,92,246,.15)'
                  : 'rgba(255,255,255,.07)'}`,
                borderRadius: 14, padding: '14px 18px',
                animation: `fadeUp .35s ${Math.min(i * 0.03, 0.5)}s ease both`,
                position: 'relative',
              }}>
                {isMe && (
                  <div style={{
                    position: 'absolute', top: 12, right: 14,
                    background: 'rgba(236,72,153,.18)', border: '1px solid rgba(236,72,153,.3)',
                    borderRadius: 100, padding: '2px 10px',
                    color: '#f9a8d4', fontSize: 10, fontWeight: 700,
                  }}>내 글</div>
                )}

                {/* 상단: 닉네임 + 아이돌 + 시간 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: entry.message ? 8 : 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: isMe ? 'rgba(236,72,153,.2)' : 'rgba(255,255,255,.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: isMe ? '#f9a8d4' : 'rgba(255,255,255,.5)',
                  }}>
                    {(entry.player || '익명').slice(0, 1)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      color: isMe ? '#f9a8d4' : 'rgba(255,255,255,.9)',
                      fontWeight: 700, fontSize: 13,
                    }}>{entry.player || '익명'}</span>
                    {/* 전체 탭에서만 아이돌 표시 (그룹명 포함하여 동명이인 구분) */}
                    {filter === 'all' && entry.celeb_name && (
                      <span style={{
                        marginLeft: 8, fontSize: 11,
                        color: isSame ? 'rgba(236,72,153,.8)' : 'rgba(255,255,255,.25)',
                      }}>
                        {entry.celeb_emoji} {entry.celeb_name}
                        {entry.celeb_group ? (
                          <span style={{ opacity: 0.6, marginLeft: 3 }}>({entry.celeb_group})</span>
                        ) : null}
                      </span>
                    )}
                  </div>

                  <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, flexShrink: 0 }}>
                    {timeAgo(entry.created_at)}
                  </span>
                </div>

                {entry.message && (
                  <div style={{
                    color: 'rgba(255,255,255,.75)', fontSize: 13,
                    lineHeight: 1.6, paddingLeft: 36,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>{entry.message}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={onHome}
        style={{
          marginTop: 32, padding: '12px 36px', zIndex: 1,
          border: '1px solid rgba(255,255,255,.1)', borderRadius: 100,
          background: 'transparent', color: 'rgba(255,255,255,.3)',
          cursor: 'pointer', fontSize: 13, transition: 'all .2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.3)' }}
      >← 홈으로</button>

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

function FilterTab({ active, onClick, label, count, color, activeColor, activeBg, activeBorder }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
      border: `1px solid ${active ? (activeBorder || 'rgba(255,255,255,.15)') : 'rgba(255,255,255,.07)'}`,
      background: active ? activeBg : 'rgba(255,255,255,.02)',
      transition: 'all .18s',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <span style={{
        color: active ? activeColor : color,
        fontSize: 12, fontWeight: 700, fontFamily: "'Noto Sans KR', sans-serif",
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
      }}>{label}</span>
      <span style={{
        color: active ? activeColor : 'rgba(255,255,255,.2)',
        fontSize: 11, fontFamily: "'Noto Sans KR', sans-serif",
      }}>{count}개</span>
    </button>
  )
}
