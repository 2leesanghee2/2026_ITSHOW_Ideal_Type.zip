import { useEffect, useRef, useState, useCallback } from 'react'

// ── 튜닝 상수 ─────────────────────────────────────────────────────────────────
const MOVE_THR     = 0.020  // IDLE→TRACKING 진입 임계 — 높여서 오발동 방지
const MIN_DISP     = 0.13   // 발동 누적 거리 — 낮춰서 빠른 발동
const MIN_FRAMES   = 3      // 같은 방향 최소 프레임 수 — 줄여서 반응성 향상
const MIN_CONSIST  = 0.60   // 방향 일관성 비율
const MAX_REVERSE  = 0.12   // 허용 역방향 거리 — 약간 관대하게
const STALE_MS     = 550    // 정지 후 취소 시간
const COOLDOWN_MS  = 850    // 발동 후 대기 시간 — 짧게, 연속 선택 쾌적
const SMOOTH_ALPHA = 0.42   // 누적용 EMA 계수 — 높여서 반응성 향상

export function useGestureCamera({ onGesture, active }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const handsRef   = useRef(null)
  const cameraRef  = useRef(null)

  // ── 제스처 추적 refs (렌더링 불필요한 내부 상태) ──────────────────────────
  const prevXRef       = useRef(null)
  const smoothDxRef    = useRef(0)
  const lockedRef      = useRef(false)   // 쿨다운 중 입력 차단

  // 추적 중 누적값
  const dirRef         = useRef(null)    // 'left' | 'right'
  const totalDispRef   = useRef(0)       // 올바른 방향 누적 거리
  const revDispRef     = useRef(0)       // 역방향 누적 거리
  const goodFramesRef  = useRef(0)       // 올바른 방향 프레임 수
  const totalFramesRef = useRef(0)       // 전체 추적 프레임 수
  const lastMoveRef    = useRef(0)       // 마지막 움직임 감지 시각

  const [camState, setCamState]         = useState('idle')
  const [gestureState, setGestureState] = useState({ dir: null, pct: 0 })

  // ── 추적 상태 초기화 ────────────────────────────────────────────────────────
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

  // ── 핵심: 매 프레임 손 위치 처리 ───────────────────────────────────────────
  const processHand = useCallback((landmarks) => {
    // 쿨다운 중에는 처리 안 함
    if (lockedRef.current) return

    // 손목만 사용 — indexTip보다 훨씬 안정적
    const handX = landmarks[0].x

    if (prevXRef.current === null) {
      prevXRef.current = handX
      return
    }

    const rawDx = handX - prevXRef.current
    prevXRef.current = handX

    // EMA는 누적 단계에서만 사용 — IDLE 진입은 raw dx로 판단
    smoothDxRef.current = smoothDxRef.current * (1 - SMOOTH_ALPHA) + rawDx * SMOOTH_ALPHA
    const now = Date.now()

    // ── IDLE: raw dx로 방향 탐지 (EMA 지연 없음) ───────────────────────────
    if (dirRef.current === null) {
      if (Math.abs(rawDx) > MOVE_THR) {
        dirRef.current         = rawDx < 0 ? 'left' : 'right'
        totalDispRef.current   = Math.abs(rawDx)
        revDispRef.current     = 0
        goodFramesRef.current  = 1
        totalFramesRef.current = 1
        lastMoveRef.current    = now
        smoothDxRef.current    = rawDx  // 첫 프레임 EMA를 raw로 초기화
        setGestureState({ dir: dirRef.current, pct: 0 })
      }
      return
    }

    // ── TRACKING: smoothed dx로 누적 ────────────────────────────────────────
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
      // 역방향 이동 누적
      revDispRef.current += speed
      if (revDispRef.current > MAX_REVERSE) {
        // 반대로 너무 많이 움직임 → 의도적 스와이프 아님, 취소
        resetTracking()
        return
      }
    }

    // 정지 타임아웃: 너무 오래 움직임 없으면 취소
    if (now - lastMoveRef.current > STALE_MS) {
      resetTracking()
      return
    }

    // 진행도 계산 (UI 표시용)
    const consistency = totalFramesRef.current > 0
      ? goodFramesRef.current / totalFramesRef.current
      : 0
    const pct = Math.min(Math.round((totalDispRef.current / MIN_DISP) * 100), 99)
    setGestureState({ dir: dirRef.current, pct })

    // ── 발동 조건: 거리 + 프레임 수 + 일관성 모두 충족 ──────────────────────
    if (
      totalDispRef.current >= MIN_DISP &&
      goodFramesRef.current >= MIN_FRAMES &&
      consistency >= MIN_CONSIST
    ) {
      lockedRef.current = true
      setGestureState({ dir: dirRef.current, pct: 100 })
      onGesture(dirRef.current)
      setTimeout(resetTracking, COOLDOWN_MS)
    }
  }, [onGesture, resetTracking])

  // ── 카메라 시작 ─────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamState('loading')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      // ※ 'ready'는 MediaPipe 로드 완료 후 첫 프레임 처리 시점으로 이동

      const { Hands }                                       = await import('@mediapipe/hands')
      const { Camera }                                      = await import('@mediapipe/camera_utils')
      const { drawConnectors, drawLandmarks, HAND_CONNECTIONS } = await import('@mediapipe/drawing_utils')

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
        // 첫 프레임이 처리될 때 비로소 '손 인식 중' 상태로 전환
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
        processHand(lm)
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
      console.error(e)
      setCamState(e.name === 'NotAllowedError' ? 'noperm' : 'error')
    }
  }, [processHand])

  // ── 카메라 종료 ─────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cameraRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    handsRef.current?.close()
    handsRef.current  = null
    cameraRef.current = null
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
