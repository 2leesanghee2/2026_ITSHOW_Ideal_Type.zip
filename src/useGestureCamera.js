import { useEffect, useRef, useState, useCallback } from 'react'

// ── 튜닝 상수 ─────────────────────────────────────────────────────────────────
const MOVE_THR     = 0.032  // IDLE→TRACKING 진입 임계
const MIN_DISP     = 0.20   // 발동 누적 거리
const MIN_FRAMES   = 5      // 같은 방향 최소 프레임 수
const MIN_CONSIST  = 0.65   // 방향 일관성 비율
const MAX_REVERSE  = 0.10   // 허용 역방향 거리
const STALE_MS     = 500    // 정지 후 취소 시간
const COOLDOWN_MS  = 1200   // 발동 후 대기 시간 (복귀 스윙 방지)
const SMOOTH_ALPHA = 0.35   // 누적용 EMA 계수

export function useGestureCamera({ onGesture, active }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const handsRef   = useRef(null)
  const cameraRef  = useRef(null)

  // onGesture를 ref로 관리 — processHand/startCamera 의존성 체인 차단
  // onGesture가 바뀌어도 카메라가 재시작되지 않음
  const onGestureRef = useRef(onGesture)
  useEffect(() => { onGestureRef.current = onGesture }, [onGesture])

  // ── 제스처 추적 refs ───────────────────────────────────────────────────────
  const prevXRef       = useRef(null)
  const smoothDxRef    = useRef(0)
  const lockedRef      = useRef(false)

  const dirRef         = useRef(null)
  const totalDispRef   = useRef(0)
  const revDispRef     = useRef(0)
  const goodFramesRef  = useRef(0)
  const totalFramesRef = useRef(0)
  const lastMoveRef    = useRef(0)

  const [camState, setCamState]         = useState('idle')
  const [gestureState, setGestureState] = useState({ dir: null, pct: 0 })

  // ── 추적 상태 초기화 — [] 의존성으로 항상 동일한 참조 ─────────────────────
  const resetTracking = useCallback(() => {
    dirRef.current         = null
    totalDispRef.current   = 0
    revDispRef.current     = 0
    goodFramesRef.current  = 0
    totalFramesRef.current = 0
    lastMoveRef.current    = 0
    smoothDxRef.current    = 0
    prevXRef.current       = null
    lockedRef.current      = false
    setGestureState({ dir: null, pct: 0 })
  }, [])

  // ── 핵심: 매 프레임 손 위치 처리 — [] 의존성으로 항상 동일한 참조 ─────────
  // onGesture는 onGestureRef.current으로 접근해 deps에서 제거
  const processHand = useCallback((landmarks) => {
    if (lockedRef.current) return

    const handX = landmarks[0].x

    if (prevXRef.current === null) {
      prevXRef.current = handX
      return
    }

    const rawDx = handX - prevXRef.current
    prevXRef.current = handX

    smoothDxRef.current = smoothDxRef.current * (1 - SMOOTH_ALPHA) + rawDx * SMOOTH_ALPHA
    const now = Date.now()

    if (dirRef.current === null) {
      if (Math.abs(rawDx) > MOVE_THR) {
        dirRef.current         = rawDx < 0 ? 'left' : 'right'
        totalDispRef.current   = Math.abs(rawDx)
        revDispRef.current     = 0
        goodFramesRef.current  = 1
        totalFramesRef.current = 1
        lastMoveRef.current    = now
        smoothDxRef.current    = rawDx
        setGestureState({ dir: dirRef.current, pct: 0 })
      }
      return
    }

    const dx     = smoothDxRef.current
    const speed  = Math.abs(dx)
    const inDir  = (dirRef.current === 'left'  && dx < -MOVE_THR * 0.4) ||
                   (dirRef.current === 'right' && dx >  MOVE_THR * 0.4)
    const revDir = (dirRef.current === 'left'  && dx >  MOVE_THR * 0.4) ||
                   (dirRef.current === 'right' && dx < -MOVE_THR * 0.4)

    totalFramesRef.current += 1

    if (inDir) {
      totalDispRef.current  += speed
      goodFramesRef.current += 1
      lastMoveRef.current    = now
    } else if (revDir) {
      revDispRef.current += speed
      if (revDispRef.current > MAX_REVERSE) {
        resetTracking()
        return
      }
    }

    if (now - lastMoveRef.current > STALE_MS) {
      resetTracking()
      return
    }

    const consistency = totalFramesRef.current > 0
      ? goodFramesRef.current / totalFramesRef.current
      : 0
    const pct = Math.min(Math.round((totalDispRef.current / MIN_DISP) * 100), 99)
    setGestureState({ dir: dirRef.current, pct })

    if (
      totalDispRef.current >= MIN_DISP &&
      goodFramesRef.current >= MIN_FRAMES &&
      consistency >= MIN_CONSIST
    ) {
      lockedRef.current = true
      setGestureState({ dir: dirRef.current, pct: 100 })
      onGestureRef.current(dirRef.current)   // ref로 호출 — deps 불필요
      setTimeout(resetTracking, COOLDOWN_MS)
    }
  }, [resetTracking])  // onGesture 제거 → processHand 참조 안정

  // ── 카메라 시작 — [] 의존성으로 절대 재생성되지 않음 ───────────────────────
  // processHand를 직접 닫지 않고 processHandRef.current으로 호출
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
      console.error('카메라 획득 실패:', e)
      setCamState(e.name === 'NotAllowedError' ? 'noperm' : 'error')
      return
    }

    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      try { await videoRef.current.play() } catch (_) {}
    }

    try {
      const Hands          = window.Hands
      const Camera         = window.Camera
      const drawConnectors = window.drawConnectors
      const drawLandmarks  = window.drawLandmarks
      const HAND_CONNECTIONS = window.HAND_CONNECTIONS

      if (!Hands || !Camera) throw new Error('MediaPipe not loaded')

      const hands = new Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`
      })
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.55,
      })
      let firstFrame = true
      hands.onResults((results) => {
        if (firstFrame) { setCamState('ready'); firstFrame = false }
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        canvas.width = 200; canvas.height = 150
        ctx.clearRect(0, 0, 200, 150)

        if (!results.multiHandLandmarks?.length) return

        const lm = results.multiHandLandmarks[0]
        ctx.save()
        drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(74,222,128,.8)', lineWidth: 2 })
        drawLandmarks(ctx, lm, { color: 'rgba(250,204,21,.9)', lineWidth: 1, radius: 3 })
        ctx.restore()
        processHandRef.current(lm)   // 항상 최신 processHand 참조
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
  }, [])  // 의존성 없음 — 카메라는 mount 시 한 번만 시작

  // ── 카메라 종료 ─────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cameraRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    handsRef.current?.close()
    handsRef.current  = null
    cameraRef.current = null
    streamRef.current = null
    setCamState('idle')
    resetTracking()
  }, [resetTracking])

  useEffect(() => {
    if (active) startCamera()
    else stopCamera()
    return () => stopCamera()
  }, [active, startCamera, stopCamera])

  return { videoRef, canvasRef, camState, gestureState, startCamera, resetGesture: resetTracking }
}
