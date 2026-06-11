import { useEffect, useRef, useState, useCallback } from 'react'

const MOVE_THR     = 0.032
const MIN_DISP     = 0.18
const MIN_FRAMES   = 4
const MIN_CONSIST  = 0.60
const MAX_REVERSE  = 0.12
const STALE_MS     = 500
const COOLDOWN_MS  = 1200
const SMOOTH_ALPHA = 0.35

export function useGestureCamera({ onGesture, active }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const handsRef  = useRef(null)
  const cameraRef = useRef(null)

  // onGesture를 ref로 보관 — 의존성 체인 차단
  const onGestureRef = useRef(onGesture)
  useEffect(() => { onGestureRef.current = onGesture }, [onGesture])

  // ── 제스처 추적 refs ───────────────────────────────────────────────────────
  const prevXRef       = useRef(null)
  const smoothDxRef    = useRef(0)
  const dirRef         = useRef(null)
  const totalDispRef   = useRef(0)
  const revDispRef     = useRef(0)
  const goodFramesRef  = useRef(0)
  const totalFramesRef = useRef(0)
  const lastMoveRef    = useRef(0)
  // setTimeout 대신 시간 기반 쿨다운 — 타이머 미발동 이슈 원천 차단
  const cooldownUntil  = useRef(0)

  const [camState, setCamState]         = useState('idle')
  const [gestureState, setGestureState] = useState({ dir: null, pct: 0 })

  // ── 추적 리셋 (인라인) — 추적 refs만 초기화, 쿨다운 건드리지 않음 ─────────
  function resetTracking() {
    dirRef.current         = null
    totalDispRef.current   = 0
    revDispRef.current     = 0
    goodFramesRef.current  = 0
    totalFramesRef.current = 0
    lastMoveRef.current    = 0
    smoothDxRef.current    = 0
    prevXRef.current       = null
  }

  // ── 핵심: 매 프레임 손 위치 처리 — [] 의존성, 절대 재생성 없음 ─────────────
  const processHand = useCallback((landmarks) => {
    const now = Date.now()

    // 시간 기반 쿨다운 — setTimeout 없이 직접 체크
    if (now < cooldownUntil.current) return

    const handX = landmarks[0].x

    if (prevXRef.current === null) {
      prevXRef.current = handX
      return
    }

    const rawDx = handX - prevXRef.current
    prevXRef.current = handX

    smoothDxRef.current = smoothDxRef.current * (1 - SMOOTH_ALPHA) + rawDx * SMOOTH_ALPHA

    // IDLE → 방향 탐지
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

    // TRACKING
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
        setGestureState({ dir: null, pct: 0 })
        return
      }
    }

    if (now - lastMoveRef.current > STALE_MS) {
      resetTracking()
      setGestureState({ dir: null, pct: 0 })
      return
    }

    const consistency = totalFramesRef.current > 0
      ? goodFramesRef.current / totalFramesRef.current : 0
    const pct = Math.min(Math.round((totalDispRef.current / MIN_DISP) * 100), 99)
    setGestureState({ dir: dirRef.current, pct })

    // 발동
    if (
      totalDispRef.current >= MIN_DISP &&
      goodFramesRef.current >= MIN_FRAMES &&
      consistency >= MIN_CONSIST
    ) {
      const firedDir = dirRef.current
      cooldownUntil.current = now + COOLDOWN_MS
      resetTracking()
      setGestureState({ dir: firedDir, pct: 100 })
      // onGesture를 다음 이벤트 루프로 미룸:
      // hands.onResults 콜백 내부에서 React setState를 다량 동기 실행하면
      // MediaPipe WASM 파이프라인이 블로킹되어 onResults가 이후 프레임에서
      // 호출되지 않는 버그 발생 → setTimeout(0)으로 콜백 반환 후 실행
      setTimeout(() => {
        onGestureRef.current(firedDir)
        setTimeout(() => setGestureState({ dir: null, pct: 0 }), COOLDOWN_MS)
      }, 0)
    }
  }, [])  // 의존성 없음 — 절대 재생성 안 됨

  // processHand를 ref로 보관 — startCamera가 항상 최신 버전 호출
  const processHandRef = useRef(processHand)
  useEffect(() => { processHandRef.current = processHand }, [processHand])

  // ── 카메라 시작 — [] 의존성, mount 시 한 번만 실행 ─────────────────────────
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
      const Hands          = window.Hands
      const Camera         = window.Camera
      const drawConnectors = window.drawConnectors
      const drawLandmarks  = window.drawLandmarks
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
        canvas.width = 200; canvas.height = 150
        ctx.clearRect(0, 0, 200, 150)
        if (!results.multiHandLandmarks?.length) return
        const lm = results.multiHandLandmarks[0]
        ctx.save()
        drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(74,222,128,.8)', lineWidth: 2 })
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
    handsRef.current  = null
    cameraRef.current = null
    streamRef.current = null
    cooldownUntil.current = 0
    resetTracking()
    setCamState('idle')
    setGestureState({ dir: null, pct: 0 })
  }, [])

  useEffect(() => {
    if (active) startCamera()
    else stopCamera()
    return () => stopCamera()
  }, [active, startCamera, stopCamera])

  return { videoRef, canvasRef, camState, gestureState, startCamera }
}
