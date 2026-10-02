import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  slots as SLOTS,
  roster as ROSTER,
  signs as SIGNS,
  whispers as WHISPERS,
  POOL,
} from './artists'

/* ============================================================
   KEY SPOTS — where the recurring key drifts
   ============================================================ */

const KEY_SPOTS: Record<number, React.CSSProperties> = {
  1: {
    bottom: '14%',
    right: '8%',
    width: '92px',
    transform: 'rotate(-22deg)',
    ['--key-opacity' as string]: 0.7,
  } as React.CSSProperties,
  3: {
    top: '18%',
    left: '12%',
    width: '130px',
    transform: 'rotate(38deg)',
    ['--key-opacity' as string]: 0.5,
  } as React.CSSProperties,
  5: {
    bottom: '22%',
    left: '18%',
    width: '58px',
    transform: 'rotate(-8deg)',
    ['--key-opacity' as string]: 0.28,
  } as React.CSSProperties,
}

const TOTAL_DEPTHS = SLOTS.length
const ABACUS_NAMESPACE = 'the-pool-at-night-liminal'

/* ============================================================
   AUDIO ENGINE
   ============================================================ */

type AudioBus = {
  ctx: AudioContext
  master: GainNode
  events: GainNode
  hum: GainNode
  reverbSend: GainNode
  reverbReturn: GainNode
  underwaterFilter: BiquadFilterNode
}

const createReverbIR = (ctx: AudioContext, duration = 3.2, decay = 2.4) => {
  const rate = ctx.sampleRate
  const length = Math.floor(rate * duration)
  const impulse = ctx.createBuffer(2, length, rate)
  for (let c = 0; c < 2; c++) {
    const channel = impulse.getChannelData(c)
    for (let i = 0; i < length; i++) {
      const t = i / length
      channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay)
    }
  }
  return impulse
}

const createNoiseBuffer = (ctx: AudioContext, seconds = 4) => {
  const rate = ctx.sampleRate
  const length = Math.floor(rate * seconds)
  const buffer = ctx.createBuffer(1, length, rate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
  return buffer
}

const buildAudio = (): AudioBus => {
  const ctx = new AudioContext()

  const master = ctx.createGain()
  master.gain.value = 0

  const underwater = ctx.createBiquadFilter()
  underwater.type = 'lowpass'
  underwater.frequency.value = 2200
  underwater.Q.value = 0.4

  const panner = ctx.createStereoPanner()
  panner.pan.value = 0

  master.connect(underwater).connect(panner).connect(ctx.destination)

  const convolver = ctx.createConvolver()
  convolver.buffer = createReverbIR(ctx, 3.2, 2.4)
  convolver.normalize = true

  const reverbSend = ctx.createGain()
  reverbSend.gain.value = 1
  reverbSend.connect(convolver)

  const reverbReturn = ctx.createGain()
  reverbReturn.gain.value = 0.55
  convolver.connect(reverbReturn).connect(master)

  const hum = ctx.createGain()
  hum.gain.value = 1

  const humFilter = ctx.createBiquadFilter()
  humFilter.type = 'lowpass'
  humFilter.frequency.value = 320
  humFilter.Q.value = 0.9

  hum.connect(humFilter)

  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 0.06
  const lfoAmt = ctx.createGain()
  lfoAmt.gain.value = 90
  lfo.connect(lfoAmt).connect(humFilter.frequency)
  lfo.start()

  const makeOsc = (type: OscillatorType, freq: number, level: number, detune = 0) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    const g = ctx.createGain()
    g.gain.value = level
    o.connect(g).connect(hum)
    o.start()
  }

  makeOsc('sine', 30, 0.55)
  makeOsc('sine', 40, 0.75)
  makeOsc('sine', 55, 0.6)
  makeOsc('sine', 55.25, 0.45)
  makeOsc('triangle', 82.4, 0.28)
  makeOsc('sine', 110, 0.14)

  const humDry = ctx.createGain()
  humDry.gain.value = 0.16
  humFilter.connect(humDry).connect(master)

  const humWet = ctx.createGain()
  humWet.gain.value = 0.42
  humFilter.connect(humWet).connect(reverbSend)

  const waterSrc = ctx.createBufferSource()
  waterSrc.buffer = createNoiseBuffer(ctx, 6)
  waterSrc.loop = true

  const waterFilter = ctx.createBiquadFilter()
  waterFilter.type = 'bandpass'
  waterFilter.frequency.value = 220
  waterFilter.Q.value = 0.7

  const waterGain = ctx.createGain()
  waterGain.gain.value = 0.05

  const waterLFO = ctx.createOscillator()
  waterLFO.type = 'sine'
  waterLFO.frequency.value = 0.09
  const waterLFOAmt = ctx.createGain()
  waterLFOAmt.gain.value = 0.03
  waterLFO.connect(waterLFOAmt).connect(waterGain.gain)
  waterLFO.start()

  waterSrc.connect(waterFilter).connect(waterGain).connect(master)

  const waterWet = ctx.createGain()
  waterWet.gain.value = 0.35
  waterFilter.connect(waterWet).connect(reverbSend)

  waterSrc.start()

  const events = ctx.createGain()
  events.gain.value = 1

  const eventsDry = ctx.createGain()
  eventsDry.gain.value = 0.75
  events.connect(eventsDry).connect(master)

  const eventsWet = ctx.createGain()
  eventsWet.gain.value = 0.7
  events.connect(eventsWet).connect(reverbSend)

  return {
    ctx,
    master,
    events,
    hum,
    reverbSend,
    reverbReturn,
    underwaterFilter: underwater,
  }
}

/* ============================================================
   EVENT SOUNDS
   ============================================================ */

const playDrip = (bus: AudioBus) => {
  const { ctx, events } = bus
  const t = ctx.currentTime
  const partials = [
    { f: 1320, gain: 0.5, decay: 0.9 },
    { f: 880, gain: 0.35, decay: 0.7 },
    { f: 440, gain: 0.18, decay: 0.5 },
  ]
  for (const p of partials) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(p.f * 1.35, t)
    osc.frequency.exponentialRampToValueAtTime(p.f, t + 0.06)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(p.gain, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay)
    osc.connect(g).connect(events)
    osc.start(t)
    osc.stop(t + p.decay + 0.05)
  }
}

const playSplash = (bus: AudioBus) => {
  const { ctx, events } = bus
  const t = ctx.currentTime

  const boom = ctx.createOscillator()
  boom.type = 'sine'
  boom.frequency.setValueAtTime(90, t)
  boom.frequency.exponentialRampToValueAtTime(40, t + 0.5)
  const boomG = ctx.createGain()
  boomG.gain.setValueAtTime(0.0001, t)
  boomG.gain.linearRampToValueAtTime(0.7, t + 0.02)
  boomG.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
  boom.connect(boomG).connect(events)
  boom.start(t)
  boom.stop(t + 0.75)

  const midDur = 0.9
  const midBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * midDur), ctx.sampleRate)
  const midData = midBuf.getChannelData(0)
  for (let i = 0; i < midData.length; i++) {
    const decay = Math.pow(1 - i / midData.length, 1.8)
    midData[i] = (Math.random() * 2 - 1) * decay
  }
  const mid = ctx.createBufferSource()
  mid.buffer = midBuf
  const midFilter = ctx.createBiquadFilter()
  midFilter.type = 'bandpass'
  midFilter.frequency.value = 850
  midFilter.Q.value = 0.9
  const midG = ctx.createGain()
  midG.gain.value = 0.55
  mid.connect(midFilter).connect(midG).connect(events)
  mid.start(t)

  const hiDur = 0.35
  const hiBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * hiDur), ctx.sampleRate)
  const hiData = hiBuf.getChannelData(0)
  for (let i = 0; i < hiData.length; i++) {
    const decay = Math.pow(1 - i / hiData.length, 3)
    hiData[i] = (Math.random() * 2 - 1) * decay
  }
  const hi = ctx.createBufferSource()
  hi.buffer = hiBuf
  const hiFilter = ctx.createBiquadFilter()
  hiFilter.type = 'highpass'
  hiFilter.frequency.value = 2800
  const hiG = ctx.createGain()
  hiG.gain.value = 0.35
  hi.connect(hiFilter).connect(hiG).connect(events)
  hi.start(t)
}

const playMuffledLaugh = (bus: AudioBus) => {
  const { ctx, events } = bus
  const t = ctx.currentTime
  const pulses = [
    { t: 0.00, f: 240, dur: 0.18 },
    { t: 0.20, f: 220, dur: 0.16 },
    { t: 0.38, f: 260, dur: 0.17 },
    { t: 0.58, f: 210, dur: 0.20 },
    { t: 0.82, f: 250, dur: 0.15 },
    { t: 1.02, f: 230, dur: 0.19 },
    { t: 1.26, f: 275, dur: 0.16 },
    { t: 1.46, f: 235, dur: 0.22 },
  ]
  for (const p of pulses) {
    const start = t + p.t
    const carrier = ctx.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.setValueAtTime(p.f, start)

    const vib = ctx.createOscillator()
    vib.type = 'sine'
    vib.frequency.value = 42
    const vibAmt = ctx.createGain()
    vibAmt.gain.value = 12
    vib.connect(vibAmt).connect(carrier.frequency)
    vib.start(start)
    vib.stop(start + p.dur)

    const formant = ctx.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.value = 620
    formant.Q.value = 3.5

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.exponentialRampToValueAtTime(0.32, start + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, start + p.dur)

    carrier.connect(formant).connect(env).connect(events)
    carrier.start(start)
    carrier.stop(start + p.dur + 0.05)
  }
}

const heartbeatThump = (
  bus: AudioBus,
  dest: AudioNode,
  delay: number,
  amp: number,
) => {
  const { ctx } = bus
  const t = ctx.currentTime + delay

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(88, t)
  osc.frequency.exponentialRampToValueAtTime(32, t + 0.18)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(amp, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + 0.36)

  const click = ctx.createOscillator()
  click.type = 'triangle'
  click.frequency.value = 180
  const clickG = ctx.createGain()
  clickG.gain.setValueAtTime(0.0001, t)
  clickG.gain.linearRampToValueAtTime(amp * 0.25, t + 0.004)
  clickG.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  click.connect(clickG).connect(dest)
  click.start(t)
  click.stop(t + 0.06)
}

/* ============================================================
   HELPERS
   ============================================================ */

const formatClock = (d: Date) => {
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
}

const randomRooftopTime = () => {
  const d = new Date()
  const hour = 3 + Math.floor(Math.random() * 3)
  const minute = Math.floor(Math.random() * 60)
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/* ============================================================
   THE KEY
   ============================================================ */

function Key({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      className="pool-key"
      style={style}
      viewBox="0 0 100 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="14" cy="15" r="10" />
      <circle cx="14" cy="15" r="3.5" />
      <line x1="24" y1="15" x2="95" y2="15" />
      <line x1="72" y1="15" x2="72" y2="26" />
      <line x1="82" y1="15" x2="82" y2="23" />
      <line x1="92" y1="15" x2="92" y2="20" />
    </svg>
  )
}

/* ============================================================
   PARTICLES
   ============================================================ */

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    if (!canvas) return
    const c2d = canvas.getContext('2d')
    if (!c2d) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0

    type P = {
      x: number
      y: number
      r: number
      vy: number
      vx: number
      life: number
      maxLife: number
      hue: number
    }
    const particles: P[] = []

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
    }
    resize()
    window.addEventListener('resize', resize)

    const spawn = (anywhere = false): P => ({
      x: Math.random() * canvas.width,
      y: anywhere ? Math.random() * canvas.height : canvas.height + 20,
      r: 0.5 + Math.random() * 1.5,
      vy: -(0.12 + Math.random() * 0.32) * dpr,
      vx: (Math.random() - 0.5) * 0.16 * dpr,
      life: anywhere ? Math.random() * 700 : 0,
      maxLife: 700 + Math.random() * 900,
      hue: Math.random() < 0.25 ? 34 : 200,
    })

    for (let i = 0; i < 46; i++) particles.push(spawn(true))

    const tick = () => {
      c2d.clearRect(0, 0, canvas.width, canvas.height)
      if (particles.length < 70 && Math.random() < 0.02) particles.push(spawn())
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life++
        if (p.life > p.maxLife || p.y < -30) {
          particles.splice(i, 1)
          continue
        }
        const t = p.life / p.maxLife
        const alpha = Math.sin(t * Math.PI) * 0.45
        const color =
          p.hue === 34
            ? `rgba(240, 184, 120, ${alpha})`
            : `rgba(180, 215, 235, ${alpha})`
        c2d.beginPath()
        c2d.arc(p.x, p.y, p.r * dpr, 0, Math.PI * 2)
        c2d.fillStyle = color
        c2d.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="pool-particles" aria-hidden="true" />
}

/* ============================================================
   VISITOR'S MARK
   ============================================================ */

type Mark = {
  name: string
  line: string
  url: string
  date: string
}

const readMark = (): Mark | null => {
  try {
    const raw = window.localStorage.getItem('pool-mark')
    if (!raw) return null
    const parsed = JSON.parse(raw) as Mark
    if (!parsed.name || !parsed.line) return null
    return parsed
  } catch {
    return null
  }
}

/* ============================================================
   APP
   ============================================================ */

export default function App() {
  const isDaytime = useMemo(() => {
    const h = new Date().getHours()
    return h >= 6 && h < 18
  }, [])

  const [soundOn, setSoundOn] = useState(false)
  const [visibleIndex, setVisibleIndex] = useState(-1)
  const [clockDisplay, setClockDisplay] = useState(() => formatClock(new Date()))
  const [isReturnVisitor, setIsReturnVisitor] = useState(false)
  const [visitorName, setVisitorName] = useState('')
  const [nameInput, setNameInput] = useState('')

  const [bootPhase, setBootPhase] = useState<
    'warning' | 'entering' | 'asking' | 'fading' | 'done'
  >(isDaytime ? 'warning' : 'entering')
  const [typedText, setTypedText] = useState('')
  const [isHolding, setIsHolding] = useState(false)

  const [visitCount, setVisitCount] = useState<number | null>(null)
  const [stayToast, setStayToast] = useState(false)
  const [showDepthBreak, setShowDepthBreak] = useState(false)

  const [mark, setMark] = useState<Mark | null>(() => readMark())
  const [markName, setMarkName] = useState('')
  const [markLine, setMarkLine] = useState('')
  const [markUrl, setMarkUrl] = useState('')

  const busRef = useRef<AudioBus | null>(null)
  const pannerRef = useRef<StereoPannerNode | null>(null)

  const ratiosRef = useRef<Map<number, number>>(new Map())
  const lastPlayedIndexRef = useRef(-1)
  const freezeArmedRef = useRef(true)

  const cursorLightRef = useRef<HTMLDivElement>(null)
  const ripplesRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const clockStateRef = useRef({
    wallMs: Date.now(),
    anchorMs: Date.now(),
    frozen: false,
  })

  const heartbeatTimerRef = useRef<number | null>(null)
  const heartbeatGainRef = useRef<GainNode | null>(null)

  const keysBufferRef = useRef('')
  const depthBreakShownRef = useRef(false)

  /* 1. Gradient shift */
  useEffect(() => {
    const root = document.documentElement
    let frame = 0
    const update = () => {
      frame = 0
      const max = root.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0
      root.style.setProperty('--pool-shift', `${(progress * 100).toFixed(2)}%`)
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  /* 2. Parallax */
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const vh = window.innerHeight
      const sections = document.querySelectorAll<HTMLElement>(
        '.depth-section[data-index]',
      )
      sections.forEach((section) => {
        const idx = section.dataset.index
        if (idx === undefined || idx === '-1') return
        const rect = section.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const offset = (center - vh / 2) / vh
        section.style.setProperty('--parallax-slow', `${(offset * 40).toFixed(2)}px`)
        section.style.setProperty('--parallax-fast', `${(offset * 70).toFixed(2)}px`)
      })
    }
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  /* 3. Reveal depths */
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('.depth-section'),
    )
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement
          const index = Number(el.dataset.index ?? '-1')
          if (entry.isIntersecting) el.classList.add('is-visible')
          if (index >= 0) ratiosRef.current.set(index, entry.intersectionRatio)
        }
        let best = -1
        let bestRatio = 0
        ratiosRef.current.forEach((ratio, index) => {
          if (index < 0) return
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = index
          }
        })
        if (best !== -1) setVisibleIndex(best)
      },
      {
        threshold: [0, 0.15, 0.35, 0.55, 0.75, 0.95],
        rootMargin: '-4% 0px -4% 0px',
      },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [isReturnVisitor, bootPhase, mark])

  /* 4. Whispers */
  useEffect(() => {
    const whispers = Array.from(document.querySelectorAll<HTMLElement>('.whisper'))
    if (whispers.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add('is-visible')
        }
      },
      { threshold: 0.35, rootMargin: '-10% 0px -10% 0px' },
    )
    whispers.forEach((w) => observer.observe(w))
    return () => observer.disconnect()
  }, [isReturnVisitor, bootPhase, mark])

  /* 5. Cursor light */
  useEffect(() => {
    const light = cursorLightRef.current
    if (!light) return
    let raf = 0
    let tx = window.innerWidth / 2
    let ty = window.innerHeight / 2
    let cx = tx, cy = ty
    const loop = () => {
      raf = 0
      cx += (tx - cx) * 0.08
      cy += (ty - cy) * 0.08
      light.style.setProperty('--mx', `${cx}px`)
      light.style.setProperty('--my', `${cy}px`)
      if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
        raf = window.requestAnimationFrame(loop)
      }
    }
    const onMove = (e: PointerEvent) => {
      tx = e.clientX
      ty = e.clientY
      if (!raf) raf = window.requestAnimationFrame(loop)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  /* 6. Stereo pan */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const bus = busRef.current
      const panner = pannerRef.current
      if (!bus || !panner) return
      const pan = (e.clientX / window.innerWidth) * 2 - 1
      panner.pan.setTargetAtTime(pan, bus.ctx.currentTime, 0.35)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  /* 7. Ripples */
  useEffect(() => {
    const container = ripplesRef.current
    if (!container) return
    const onPointerDown = (e: PointerEvent) => {
      const ripple = document.createElement('span')
      ripple.className = 'pool-ripple'
      ripple.style.left = `${e.clientX}px`
      ripple.style.top = `${e.clientY}px`
      container.appendChild(ripple)
      window.setTimeout(() => ripple.remove(), 2400)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  /* 8. Live clock */
  useEffect(() => {
    const state = clockStateRef.current
    const update = () => {
      if (state.frozen) {
        setClockDisplay('03:47 AM')
        return
      }
      const elapsed = Date.now() - state.anchorMs
      const d = new Date(state.wallMs + elapsed)
      setClockDisplay(formatClock(d))
    }
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (visibleIndex < 2) freezeArmedRef.current = true
    if (
      visibleIndex >= 2 &&
      freezeArmedRef.current &&
      !clockStateRef.current.frozen
    ) {
      clockStateRef.current.frozen = true
      freezeArmedRef.current = false
      setClockDisplay('03:47 AM')
    }
  }, [visibleIndex])

  /* 9. Boot sequence */
  const currentPhrase =
    bootPhase === 'warning' ? 'the pool is not open yet' : 'entering the pool...'
  const currentHold = bootPhase === 'warning' ? 4000 : 900

  useEffect(() => {
    if (bootPhase !== 'warning' && bootPhase !== 'entering') return
    if (isHolding) {
      const t = window.setTimeout(() => {
        setIsHolding(false)
        setTypedText('')
        if (bootPhase === 'warning') setBootPhase('entering')
        else setBootPhase(visitorName ? 'fading' : 'asking')
      }, currentHold)
      return () => window.clearTimeout(t)
    }
    if (typedText.length < currentPhrase.length) {
      const t = window.setTimeout(() => {
        setTypedText(currentPhrase.slice(0, typedText.length + 1))
      }, 75)
      return () => window.clearTimeout(t)
    }
    setIsHolding(true)
  }, [typedText, isHolding, bootPhase, currentPhrase, currentHold, visitorName])

  useEffect(() => {
    if (bootPhase !== 'fading') return
    const t = window.setTimeout(() => setBootPhase('done'), 1700)
    return () => window.clearTimeout(t)
  }, [bootPhase])

  /* 10. Stored name + return visitor */
  useEffect(() => {
    try {
      const storedName = window.localStorage.getItem('pool-name')
      if (storedName) setVisitorName(storedName)
      const visited = window.localStorage.getItem('pool-visited')
      if (visited) setIsReturnVisitor(true)
      else window.localStorage.setItem('pool-visited', '1')
    } catch { /* ignore */ }
  }, [])

  /* 11. Lock scroll */
  useEffect(() => {
    document.body.style.overflow = bootPhase === 'done' ? '' : 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [bootPhase])

  /* 12. Focus name input */
  useEffect(() => {
    if (bootPhase !== 'asking') return
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 400)
    return () => window.clearTimeout(t)
  }, [bootPhase])

  /* 13. Visitor counter */
  useEffect(() => {
    try {
      const cached = window.sessionStorage.getItem('pool-count')
      if (cached) {
        setVisitCount(parseInt(cached, 10))
        return
      }
    } catch { /* ignore */ }
    const today = new Date().toISOString().slice(0, 10)
    const url = `https://abacus.jasoncameron.dev/hit/${ABACUS_NAMESPACE}/pool-${today}`
    const ctrl = new AbortController()
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.value === 'number') {
          setVisitCount(data.value)
          try {
            window.sessionStorage.setItem('pool-count', String(data.value))
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* ignore */ })
    return () => ctrl.abort()
  }, [])

  /* 14. Depth events */
  useEffect(() => {
    if (!soundOn) return
    const bus = busRef.current
    if (!bus) return
    const last = lastPlayedIndexRef.current
    if (last === visibleIndex) return
    lastPlayedIndexRef.current = visibleIndex

    if (visibleIndex === 0 && last < 0) playDrip(bus)
    if (visibleIndex === 2 && last < 2) playSplash(bus)
    if (visibleIndex === 4 && last < 4) playMuffledLaugh(bus)
    if (visibleIndex === 5 && last < 5) {
      const t = bus.ctx.currentTime
      bus.master.gain.cancelScheduledValues(t)
      bus.master.gain.setValueAtTime(bus.master.gain.value, t)
      bus.master.gain.linearRampToValueAtTime(0, t + 4)
      window.setTimeout(() => setSoundOn(false), 4200)
    }
  }, [visibleIndex, soundOn])

  /* 15. Heartbeat */
  useEffect(() => {
    const stopHeartbeat = () => {
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
      const bus = busRef.current
      const hb = heartbeatGainRef.current
      if (!bus || !hb) return
      const t = bus.ctx.currentTime
      hb.gain.cancelScheduledValues(t)
      hb.gain.setValueAtTime(hb.gain.value, t)
      hb.gain.linearRampToValueAtTime(0, t + 2.4)
      window.setTimeout(() => {
        if (heartbeatGainRef.current === hb) heartbeatGainRef.current = null
      }, 3000)
    }

    const startHeartbeat = () => {
      const bus = busRef.current
      if (!bus) return
      if (heartbeatTimerRef.current !== null) return
      const hbGain = bus.ctx.createGain()
      hbGain.gain.value = 0
      hbGain.connect(bus.master)
      heartbeatGainRef.current = hbGain
      const beat = () => {
        heartbeatThump(bus, hbGain, 0, 0.55)
        heartbeatThump(bus, hbGain, 0.16, 0.32)
      }
      beat()
      heartbeatTimerRef.current = window.setInterval(beat, 1500)
      const t = bus.ctx.currentTime
      hbGain.gain.cancelScheduledValues(t)
      hbGain.gain.setValueAtTime(0, t)
      hbGain.gain.linearRampToValueAtTime(0.22, t + 3)
    }

    if (!soundOn) {
      stopHeartbeat()
      return
    }
    if (visibleIndex >= 2 && visibleIndex <= 4) startHeartbeat()
    else stopHeartbeat()
  }, [soundOn, visibleIndex])

  /* 16. Image blinks */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let cancelled = false
    let tid: number | null = null
    const schedule = () => {
      const delay = 90000 + Math.random() * 90000
      tid = window.setTimeout(() => {
        if (cancelled) return
        const visible = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.depth-section.is-visible[data-index]',
          ),
        ).filter((s) => s.dataset.index !== '-1')
        if (visible.length > 0) {
          const target = visible[Math.floor(Math.random() * visible.length)]
          target.classList.add('is-blinking')
          window.setTimeout(() => target.classList.remove('is-blinking'), 180)
        }
        schedule()
      }, delay)
    }
    schedule()
    return () => {
      cancelled = true
      if (tid !== null) window.clearTimeout(tid)
    }
  }, [bootPhase])

  /* 17. Depth 06 break */
  useEffect(() => {
    if (visibleIndex !== 5) return
    if (depthBreakShownRef.current) return
    let alreadySeen = false
    try { alreadySeen = sessionStorage.getItem('pool-depthbreak') === '1' } catch { /* ignore */ }
    if (alreadySeen) return
    depthBreakShownRef.current = true
    setShowDepthBreak(true)
    try { sessionStorage.setItem('pool-depthbreak', '1') } catch { /* ignore */ }
    const t = window.setTimeout(() => setShowDepthBreak(false), 3200)
    return () => window.clearTimeout(t)
  }, [visibleIndex])

  /* 18. Return to surface */
  const returnToSurface = useCallback(() => {
    clockStateRef.current = {
      wallMs: randomRooftopTime(),
      anchorMs: Date.now(),
      frozen: false,
    }
    freezeArmedRef.current = false
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  /* 19. Hidden words */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key.length !== 1) return
      keysBufferRef.current = (
        keysBufferRef.current + e.key.toLowerCase()
      ).slice(-20)
      if (keysBufferRef.current.endsWith('surface')) {
        keysBufferRef.current = ''
        returnToSurface()
      } else if (keysBufferRef.current.endsWith('stay')) {
        keysBufferRef.current = ''
        setStayToast(true)
        window.setTimeout(() => setStayToast(false), 3000)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [returnToSurface])

  /* 20. Name submit */
  const handleNameSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = nameInput.trim().slice(0, 24)
      if (!trimmed) return
      setVisitorName(trimmed)
      try { window.localStorage.setItem('pool-name', trimmed) } catch { /* ignore */ }
      setBootPhase('fading')
    },
    [nameInput],
  )

  /* 21. Sound toggle */
  const toggleSound = useCallback(() => {
    if (!busRef.current) {
      try {
        busRef.current = buildAudio()
      } catch {
        return
      }
    }
    const bus = busRef.current
    if (!bus) return
    if (bus.ctx.state === 'suspended') void bus.ctx.resume()
    const now = bus.ctx.currentTime
    bus.master.gain.cancelScheduledValues(now)
    bus.master.gain.setValueAtTime(bus.master.gain.value, now)
    if (soundOn) {
      bus.master.gain.linearRampToValueAtTime(0, now + 1.6)
      setSoundOn(false)
    } else {
      bus.master.gain.linearRampToValueAtTime(0.85, now + 3)
      setSoundOn(true)
      lastPlayedIndexRef.current = visibleIndex
    }
  }, [soundOn, visibleIndex])

  /* 22. Cleanup audio */
  useEffect(() => {
    return () => {
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
      const bus = busRef.current
      busRef.current = null
      heartbeatGainRef.current = null
      pannerRef.current = null
      if (bus && bus.ctx.state !== 'closed') void bus.ctx.close()
    }
  }, [])

  /* 23. Mark submit */
  const handleMarkSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const name = markName.trim().slice(0, 24)
      const line = markLine.trim().slice(0, 80)
      const url = markUrl.trim().slice(0, 200)
      if (!name || !line) return
      const newMark: Mark = {
        name,
        line,
        url,
        date: new Date().toLocaleDateString('en-GB'),
      }
      try {
        window.localStorage.setItem('pool-mark', JSON.stringify(newMark))
      } catch { /* ignore */ }
      setMark(newMark)
    },
    [markName, markLine, markUrl],
  )

  const editMark = useCallback(() => {
    if (!mark) return
    setMarkName(mark.name)
    setMarkLine(mark.line)
    setMarkUrl(mark.url)
    try { window.localStorage.removeItem('pool-mark') } catch { /* ignore */ }
    setMark(null)
  }, [mark])

  /* ---- render ---- */
  const depthLabel =
    visibleIndex >= 0 ? String(visibleIndex + 1).padStart(2, '0') : '00'
  const finalGuestName = visitorName ? visitorName.toUpperCase() : 'you'

  const loaderClass =
    bootPhase === 'done'
      ? 'pool-loader is-hidden'
      : bootPhase === 'fading'
        ? 'pool-loader is-fading'
        : 'pool-loader'

  return (
    <div className="pool-app">
      <svg className="pool-filter-defs" aria-hidden="true" focusable="false" width="0" height="0">
        <defs>
          <filter id="pool-wet" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008 0.02"
              numOctaves={2}
              seed={4}
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="8s"
                values="0.008 0.02; 0.014 0.032; 0.008 0.02"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={5}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {bootPhase !== 'done' && (
        <div className={loaderClass} aria-hidden={bootPhase === 'fading'}>
          <p className="pool-loader-text">
            {typedText}
            {(bootPhase === 'warning' || bootPhase === 'entering') && !isHolding && (
              <span className="caret" />
            )}
          </p>
          {bootPhase === 'asking' && (
            <form className="name-prompt" onSubmit={handleNameSubmit}>
              <label htmlFor="visitor-name">what should we call you?</label>
              <input
                ref={nameInputRef}
                id="visitor-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="your name"
                autoComplete="off"
                spellCheck={false}
                maxLength={24}
              />
              <button type="submit">enter the pool</button>
            </form>
          )}
        </div>
      )}

      <div className="pool-bg" aria-hidden="true" />
      <div className="pool-caustics" aria-hidden="true" />
      <Particles />
      <div className="pool-grain" aria-hidden="true" />

      <div ref={cursorLightRef} className="cursor-light" aria-hidden="true" />
      <div ref={ripplesRef} className="pool-ripples" aria-hidden="true" />

      <button
        type="button"
        className={`sound-toggle${soundOn ? ' is-on' : ''}`}
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? 'Turn ambient hum off' : 'Turn ambient hum on'}
      >
        <span className="dot" aria-hidden="true" />
        {soundOn ? 'Sound on' : 'Sound off'}
      </button>

      {stayToast && (
        <div className="stay-toast" role="status">
          you can't.
        </div>
      )}

      <main>
        {/* ---------- HERO ---------- */}
        <section className="surface">
          <h1>
            The pool is <em>still open.</em>
          </h1>
          <p className="timestamp">{clockDisplay} · The rooftop</p>
          <p className="surface-note">Six artists · One pool · Scroll to sink</p>
          <div className="scroll-cue" aria-hidden="true">
            <span className="scroll-line" />
            <span>Descend</span>
          </div>
        </section>

        {/* ---------- DEPTHS ---------- */}
        {SLOTS.map((slot, index) => {
          const a = slot.artist
          return (
            <Fragment key={a.name + index}>
              <section
                className="depth-section"
                data-index={index}
                aria-label={`${slot.poolCaption} — ${a.name}`}
              >
                <div
                  className="depth-image"
                  style={{ backgroundImage: `url("${a.image}")` }}
                  aria-hidden="true"
                />
                <div className="depth-veil" aria-hidden="true" />

                <span className="pool-sign" aria-hidden="true">
                  {SIGNS[index]}
                </span>

                {KEY_SPOTS[index] && <Key style={KEY_SPOTS[index]} />}

                <div className="depth-text">
                  <h2>{slot.poolLine}</h2>
                  <p className="depth-caption">{slot.poolCaption}</p>

                  <div className="artist-block">
                    <p className="artist-note">"{a.note}"</p>
                    <a
                      className="artist-credit"
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="artist-name">{a.name}</span>
                      <span className="artist-dot">·</span>
                      <span className="artist-handle">{a.handle}</span>
                      <span className="artist-dot">·</span>
                      <span className="artist-city">{a.city}</span>
                      <span className="artist-arrow">↗</span>
                    </a>
                    <span className="artist-meta">
                      {a.medium} · since {a.since}
                    </span>
                  </div>
                </div>

                {index === 5 && showDepthBreak && (
                  <div className="depth-break" aria-hidden="true">
                    this website is watching you back
                  </div>
                )}
              </section>

              {index < SLOTS.length - 1 && (
                <div className="whisper" aria-hidden="true">
                  <span>{WHISPERS[index]}</span>
                </div>
              )}
            </Fragment>
          )
        })}

        {/* ---------- ARTIST ROSTER ---------- */}
        <section className="depth-section guest-log" data-index={-1}>
          <div className="depth-text guest-log-text">
            <h2>The guest log.</h2>
            <p className="guest-log-sub">
              everyone who has ever swum in this pool
            </p>
            <ul>
              {ROSTER.map((g, i) => (
                <li key={g.name + g.date} style={{ transitionDelay: `${1 + i * 0.35}s` }}>
                  <span className="log-name">{g.name}</span>
                  <span className="log-dot">·</span>
                  <span className="log-handle">{g.handle}</span>
                  <span className="log-dot">·</span>
                  <span className="log-date">{g.date}</span>
                  <span className="log-dot">·</span>
                  <span className="log-note">{g.note}</span>
                </li>
              ))}
              <li style={{ transitionDelay: `${1 + ROSTER.length * 0.35}s` }}>
                <span className="log-name is-you">{finalGuestName}</span>
                <span className="log-dot">·</span>
                <span className="log-handle">you</span>
                <span className="log-dot">·</span>
                <span className="log-date">today</span>
                <span className="log-dot">·</span>
                <span className="log-note">still here</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ---------- LEAVE YOUR MARK ---------- */}
        <section className="depth-section mark-section" data-index={-1}>
          <div className="depth-text mark-text">
            <h2>Leave your mark.</h2>
            {!mark ? (
              <>
                <p className="mark-sub">
                  one line. your name. kept here for as long as you keep it.
                </p>
                <form className="mark-form" onSubmit={handleMarkSubmit}>
                  <input
                    type="text"
                    value={markName}
                    onChange={(e) => setMarkName(e.target.value)}
                    placeholder="your name"
                    maxLength={24}
                    required
                  />
                  <input
                    type="text"
                    value={markLine}
                    onChange={(e) => setMarkLine(e.target.value)}
                    placeholder="one line you want to leave"
                    maxLength={80}
                    required
                  />
                  <input
                    type="url"
                    value={markUrl}
                    onChange={(e) => setMarkUrl(e.target.value)}
                    placeholder="link (optional)"
                    maxLength={200}
                  />
                  <button type="submit">keep it in the pool</button>
                </form>
              </>
            ) : (
              <div className="mark-card">
                <p className="mark-card-line">"{mark.line}"</p>
                <p className="mark-card-name">— {mark.name}</p>
                {mark.url && (
                  <a
                    className="mark-card-url"
                    href={mark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {mark.url.replace(/^https?:\/\//, '').slice(0, 40)} ↗
                  </a>
                )}
                <p className="mark-card-date">kept since {mark.date}</p>
                <button type="button" className="mark-edit" onClick={editMark}>
                  edit or remove your mark
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ---------- THE DEEP END ---------- */}
        <section className="depth-section deep-end" data-index={-1}>
          <div className="depth-text deep-end-text">
            <h2>Where the pool meets.</h2>
            <p className="deep-end-sub">
              artists in this pool talk to each other here.
              <br />
              anyone can listen. anyone can join.
            </p>
            <a
              className="deep-end-link"
              href={POOL.deepEndUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              enter the deep end ↗
            </a>
          </div>
        </section>

        {/* ---------- DEPTH 07 ---------- */}
        {isReturnVisitor && (
          <section className="depth-section depth-seven" data-index={-1}>
            <div className="depth-text">
              <h2>
                {visitorName
                  ? `Depth 07 · Welcome back, ${visitorName}.`
                  : 'Depth 07 · You came back.'}
              </h2>
            </div>
          </section>
        )}

        {/* ---------- FOOTER ---------- */}
        <footer className="pool-footer">
          <p>
            The Pool at Night · Artist Meet ·{' '}
            <span className="depth-counter">{depthLabel}</span> /{' '}
            {String(TOTAL_DEPTHS).padStart(2, '0')}
          </p>
          {visitCount !== null && (
            <p className="visitor-counter">
              you are the {ordinal(visitCount)} swimmer tonight
            </p>
          )}
          <div className="footer-actions">
            <button type="button" className="surface-link" onClick={returnToSurface}>
              ↑ Surface
            </button>
            <a
              className="surface-link submit-link"
              href={POOL.submitUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              submit your work ↗
            </a>
          </div>
          <p className="pool-footnote">v1.0 · last updated 03:47 AM</p>
        </footer>
      </main>
    </div>
  )
}
