import { useEffect, useRef, useState, useCallback } from 'react'

// ── 파라미터 ──────────────────────────────────────────────────────────
const ZONE_THR      = 0.55   // x > 0.55 → 왼쪽존, x < 0.45 → 오른쪽존

// 안정화: 존 안에서 가로로 멈춰있어야 탭 감지 활성
const STABLE_FRAMES = 5      // 연속 N프레임 동안 X속도 낮아야 탭 가능 (≈150ms)
const MAX_X_STABLE  = 0.010  // X속도 이 이하 = "가로 정지 중"

// 탭 감지 (손이 정지 중일 때만)
const Y_VEL_THR     = 0.022  // 위아래 움직임 임계
const SIZE_VEL_THR  = 0.018  // 카메라 쪽 찌르기 임계 (손 크기 증가)

const TAP_COOLDOWN  = 400    // 탭 간 최소 ms
const TAP_WINDOW_MS = 3000
const COOLDOWN_MS   = 1200

function getHandSize(lm) {
  const dx = lm[12].x - lm[0].x
  const dy = lm[12].y - lm[0].y
  return Math.hypot(dx, dy)
}

function getZone(x) {
  if (x > ZONE_THR)      return 'left'
  if (x < 1 - ZONE_THR) return 'right'
  return null
}

export function useGestureCamera({ onGesture, active }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const handsRef  = useRef(null)
  const cameraRef = useRef(null)

  const onGestureRef = useRef(onGesture)
  useEffect(() => { onGestureRef.current = onGesture }, [onGesture])

  // ── 속도 추적 ─────────────────────────────────────────────────────
  const prevXRef   = useRef(null)
  const prevYRef   = useRef(null)
  const prevSzRef  = useRef(null)
  const xVelRef    = useRef(0)
  const yVelRef    = useRef(0)
  const szVelRef   = useRef(0)
  const handXRef   = useRef(0.5)

  // ── 안정화 카운터 ─────────────────────────────────────────────────
  // 존 안에서 X속도가 낮은 프레임을 누적 → STABLE_FRAMES 이상이면 탭 허용
  const stableRef  = useRef(0)
  const prevZoneRef = useRef(null)

  // ── 탭 시퀀스 ─────────────────────────────────────────────────────
  const tapDirRef   = useRef(null)
  const tapCountRef = useRef(0)
  const firstTapRef = useRef(0)
  const lastTapRef  = useRef(0)

  // ── 쿨다운 & 안정화 ──────────────────────────────────────────────
  const cooldownUntil = useRef(0)
  const needRestRef   = useRef(false)
  const restFrames    = useRef(0)
  const restPrevX     = useRef(null)

  const [camState, setCamState]         = useState('idle')
  const [gestureState, setGestureState] = useState({ dir: null, pct: 0 })
  const [handZone, setHandZone]         = useState(null)

  function resetTap() {
    tapDirRef.current   = null
    tapCountRef.current = 0
    firstTapRef.current = 0
  }

  const processHand = useCallback((landmarks) => {
    const now   = Date.now()
    const handX = landmarks[0].x
    const handY = landmarks[0].y
    handXRef.current = handX

    const handSize = getHandSize(landmarks)
    const zone     = getZone(handX)
    setHandZone(zone)

    // ── 속도 계산 ─────────────────────────────────────────────────
    if (prevXRef.current !== null) {
      xVelRef.current  = xVelRef.current  * 0.4 + (handX - prevXRef.current)  * 0.6
      yVelRef.current  = yVelRef.current  * 0.4 + (handY - prevYRef.current)   * 0.6
      szVelRef.current = szVelRef.current * 0.4 + (handSize - prevSzRef.current) * 0.6
    }
    prevXRef.current  = handX
    prevYRef.current  = handY
    prevSzRef.current = handSize

    // ── 발동 후 안정화 ────────────────────────────────────────────
    if (needRestRef.current) {
      if (restPrevX.current !== null) {
        if (Math.abs(handX - restPrevX.current) < 0.04) {
          if (++restFrames.current >= 5) {
            needRestRef.current = false
            restFrames.current  = 0
            restPrevX.current   = null
            resetTap()
            stableRef.current   = 0
            prevZoneRef.current = null
          }
        } else {
          restFrames.current = 0
        }
      }
      restPrevX.current = handX
      return
    }

    if (now < cooldownUntil.current) return

    // ── 존 이탈 처리 ───────────────────────────────────────────────
    if (zone === null) {
      stableRef.current   = 0
      prevZoneRef.current = null
      if (tapCountRef.current > 0 && now - firstTapRef.current > TAP_WINDOW_MS) {
        resetTap()
        setGestureState({ dir: null, pct: 0 })
      }
      return
    }

    // 존이 바뀌면 안정화 리셋
    if (zone !== prevZoneRef.current) {
      stableRef.current = 0
      prevZoneRef.current = zone
    }

    // ── 안정화 카운터 누적 ────────────────────────────────────────
    // X속도가 낮으면 "손이 옆으로 안 움직이는 중" → 안정 프레임 +1
    if (Math.abs(xVelRef.current) < MAX_X_STABLE) {
      stableRef.current = Math.min(stableRef.current + 1, STABLE_FRAMES * 3)
    } else {
      // 가로 이동 중 → 안정화 리셋 (스윙 차단 핵심!)
      stableRef.current = 0
    }

    // 안정화 미달 = 스윙 중 또는 방금 진입 → 탭 무시
    if (stableRef.current < STABLE_FRAMES) return

    // ── 탭 감지 (안정 중일 때만) ──────────────────────────────────
    const yMoved    = Math.abs(yVelRef.current)  > Y_VEL_THR
    const sizeMoved = szVelRef.current > SIZE_VEL_THR

    if ((yMoved || sizeMoved) && now - lastTapRef.current > TAP_COOLDOWN) {
      lastTapRef.current = now

      if (tapDirRef.current !== null && tapDirRef.current !== zone) resetTap()

      if (tapDirRef.current === null) {
        tapDirRef.current   = zone
        firstTapRef.current = now
      }

      if (now - firstTapRef.current > TAP_WINDOW_MS) {
        resetTap()
        tapDirRef.current   = zone
        firstTapRef.current = now
      }

      tapCountRef.current++
      const pct = Math.round((tapCountRef.current / 2) * 100)
      setGestureState({ dir: zone, pct })

      if (tapCountRef.current >= 2) {
        const firedDir = tapDirRef.current
        cooldownUntil.current = now + COOLDOWN_MS
        needRestRef.current   = true
        restFrames.current    = 0
        restPrevX.current     = null
        resetTap()
        setGestureState({ dir: firedDir, pct: 100 })
        setTimeout(() => {
          onGestureRef.current(firedDir)
          setTimeout(() => setGestureState({ dir: null, pct: 0 }), 400)
        }, 0)
      }
    }
  }, [])

  const processHandRef = useRef(processHand)
  useEffect(() => { processHandRef.current = processHand }, [processHand])

  const startCamera = useCallback(async () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCamState('loading')

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      })
    } catch (e) {
      setCamState(e.name === 'NotAllowedError' ? 'noperm' : 'error')
      return
    }

    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      try { await videoRef.current.play() } catch (_) {}
    }

    try {
      const Hands            = window.Hands
      const Camera           = window.Camera
      const drawConnectors   = window.drawConnectors
      const drawLandmarks    = window.drawLandmarks
      const HAND_CONNECTIONS = window.HAND_CONNECTIONS
      if (!Hands || !Camera) throw new Error('MediaPipe not loaded')

      const hands = new Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`
      })
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1,
        minDetectionConfidence: 0.65, minTrackingConfidence: 0.55 })

      let firstFrame = true
      hands.onResults(results => {
        if (firstFrame) { setCamState('ready'); firstFrame = false }
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const W = 200, H = 150
        canvas.width = W; canvas.height = H
        ctx.clearRect(0, 0, W, H)

        const hz = getZone(handXRef.current)
        const isStable = stableRef.current >= STABLE_FRAMES

        // 존 오버레이 — 안정화됐을 때 더 밝게
        const leftAlpha  = hz === 'left'  ? (isStable ? 0.55 : 0.25) : 0.08
        const rightAlpha = hz === 'right' ? (isStable ? 0.55 : 0.25) : 0.08
        ctx.fillStyle = `rgba(139,92,246,${leftAlpha})`
        ctx.fillRect(W / 2, 0, W / 2, H)
        ctx.fillStyle = `rgba(236,72,153,${rightAlpha})`
        ctx.fillRect(0, 0, W / 2, H)

        // 안정화 바 (존에 들어온 뒤 얼마나 진행됐는지)
        if (hz !== null) {
          const barW = (stableRef.current / STABLE_FRAMES) * (W / 2)
          ctx.fillStyle = hz === 'left' ? 'rgba(167,139,250,0.7)' : 'rgba(244,114,182,0.7)'
          if (hz === 'left')  ctx.fillRect(W / 2, H - 4, barW, 4)
          if (hz === 'right') ctx.fillRect(W / 2 - barW, H - 4, barW, 4)
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1; ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
        ctx.setLineDash([])

        ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = hz === 'left'  ? '#fff' : 'rgba(255,255,255,0.25)'
        ctx.fillText('👈', W * 3 / 4, H / 2)
        ctx.fillStyle = hz === 'right' ? '#fff' : 'rgba(255,255,255,0.25)'
        ctx.fillText('👉', W / 4, H / 2)

        if (!results.multiHandLandmarks?.length) return
        const lm = results.multiHandLandmarks[0]
        ctx.save()
        drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(74,222,128,.9)', lineWidth: 2 })
        drawLandmarks(ctx, lm, { color: 'rgba(250,204,21,.9)', lineWidth: 1, radius: 3 })
        ctx.restore()

        processHandRef.current(lm)
      })

      handsRef.current = hands
      const cam = new Camera(videoRef.current, {
        onFrame: async () => {
          if (handsRef.current) await handsRef.current.send({ image: videoRef.current })
        },
        width: 320, height: 240,
      })
      cam.start()
      cameraRef.current = cam
    } catch (e) {
      console.error('MediaPipe 로드 실패:', e)
      setCamState('ready')
    }
  }, [])

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    handsRef.current?.close()
    handsRef.current    = null
    cameraRef.current   = null
    streamRef.current   = null
    cooldownUntil.current = 0
    needRestRef.current   = false
    restFrames.current    = 0
    restPrevX.current     = null
    prevXRef.current      = null
    prevYRef.current      = null
    prevSzRef.current     = null
    xVelRef.current       = 0
    yVelRef.current       = 0
    szVelRef.current      = 0
    stableRef.current     = 0
    prevZoneRef.current   = null
    resetTap()
    setCamState('idle')
    setGestureState({ dir: null, pct: 0 })
    setHandZone(null)
  }, [])

  useEffect(() => {
    if (active) startCamera()
    else stopCamera()
    return () => stopCamera()
  }, [active, startCamera, stopCamera])

  return { videoRef, canvasRef, camState, gestureState, handZone, startCamera }
}
