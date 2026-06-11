import React, { useState, useEffect, useCallback } from 'react'
import WelcomePage from './WelcomePage'
import ConditionPage from './ConditionPage'
import WorldCupPage from './WorldCupPage'
import ResultPage from './ResultPage'
import LeaderboardPage from './LeaderboardPage'
import { CELEBRITIES } from './data'
import { supabase } from './supabase'

export default function App() {
  const [page, setPage] = useState('welcome')
  const [winner, setWinner] = useState(null)
  const [nickname, setNickname] = useState('')
  const [gameKey, setGameKey] = useState(0)
  const [pool, setPool] = useState([])
  const [celebrities, setCelebrities] = useState(CELEBRITIES)

  useEffect(() => {
    if (!supabase) return
    supabase.from('celebrities').select('*').order('id')
      .then(({ data, error }) => {
        if (!error && data?.length > 0) setCelebrities(data)
      })
  }, [])

  const goHome = useCallback(() => {
    setWinner(null)
    setPool([])
    setPage('welcome')
  }, [])

  // 60초 무활동 → 웰컴 화면으로 리셋 (키오스크용)
  // 제스처 감지 이벤트(gesture-activity)도 타이머 리셋에 포함
  useEffect(() => {
    if (page === 'welcome') return
    let timer = setTimeout(goHome, 60_000)
    const poke = () => { clearTimeout(timer); timer = setTimeout(goHome, 60_000) }
    window.addEventListener('mousemove', poke, { passive: true })
    window.addEventListener('touchstart', poke, { passive: true })
    window.addEventListener('keydown', poke, { passive: true })
    window.addEventListener('gesture-activity', poke)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', poke)
      window.removeEventListener('touchstart', poke)
      window.removeEventListener('keydown', poke)
      window.removeEventListener('gesture-activity', poke)
    }
  }, [page, goHome])

  const goCondition = () => setPage('condition')

  const startGame = (filteredPool) => {
    setWinner(null)
    setPool(filteredPool)
    setGameKey(k => k + 1)
    setPage('worldcup')
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1a0d38' }}>
      {page === 'welcome'     && <WelcomePage onStart={goCondition} />}
      {page === 'condition'   && <ConditionPage onStart={startGame} onBack={goHome} celebrities={celebrities} />}
      {page === 'worldcup'    && <WorldCupPage key={gameKey} pool={pool} onFinish={w => { setWinner(w); setPage('result') }} onActivity={() => window.dispatchEvent(new Event('gesture-activity'))} />}
      {page === 'result'      && <ResultPage winner={winner} onRetry={goCondition} onLeaderboard={nick => { setNickname(nick); setPage('leaderboard') }} />}
      {page === 'leaderboard' && <LeaderboardPage winner={winner} nickname={nickname} onHome={goHome} />}
    </div>
  )
}
