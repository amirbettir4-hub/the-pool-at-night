import { useCallback, useEffect, useRef, useState } from 'react'

type Depth = {
  line: string
  caption: string
  image: string
}

const depths: Depth[] = [
  {
    line: 'You are still here.',
    caption: 'Depth 01 · The surface was never the surface',
    image:
      'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?auto=format&fit=crop&w=2200&q=85',
  },
  {
    line: 'The water remembers your name.',
    caption: 'Depth 02 · Something is swimming with you',
    image:
      'https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&w=2200&q=85',
  },
  {
    line: 'There is a room down here.',
    caption: 'Depth 03 · Its lights are on',
    image:
      'https://images.unsplash.com/photo-1530053969600-caed2596d242?auto=format&fit=crop&w=2200&q=85',
  },
  {
    line: 'Someone left the door open.',
    caption: "Depth 04 · You've been here before",
    image:
      'https://images.unsplash.com/photo-1518877593221-1f28583780b4?auto=format&fit=crop&w=2200&q=85',
  },
  {
    line: 'Keep going.',
    caption: 'Depth 05 · It gets warmer',
    image:
      'https://images.unsplash.com/photo-1468581264429-2548ef9eb732?auto=format&fit=crop&w=2200&q=85',
  },
  {
    line: "You've reached the bottom.",
    caption: 'Depth 06 · There is no bottom',
    image:
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2200&q=85',
  },
]

const SIGNS = [
  'NO DIVING',
  'POOL HOURS · 06:00 – 04:00',
  'CAPACITY · 12',
  'NO RUNNING',
  'CURRENT · 1',
  'NO LEAVING',
]

const GUEST_LOG = [
  { name: 'AMY L.', date: '07 / 14 / 1998', note: 'depth 4' },
  { name: 'M. KOWALSKI', date: '06 / 02 / 2001', note: 'never came back' },
  { name: 'T. —', date: '11 / 23 / 2008', note: 'left a key' },
  { name: 'J. & J.', date: '03 / 03 / 2019', note: 'still swimming' },
  { name: 'you', date: 'today', note: 'still here' },
]

const TOTAL_DEPTHS = depths.length

/* ------------------------------------------------------------
   Audio helpers — small synthesized sounds (no audio files)
   ------------------------------------------------------------ */

const playDrip = (ctx: AudioContext, dest: AudioNode) => {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1100, t)
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.22)

  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.55, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)

  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + 0.5)
}

const playSplash = (ctx: AudioContext, dest: AudioNode) => {
  const t = ctx.currentTime
  const duration = 1.2
  const buffer = ctx.createBuffer(
    1,
    Math.floor(ctx.sampleRate * duration),
    ctx.sampleRate,
  )
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const decay = Math.pow(1 - i / data.length, 2.2)
    data[i] = (Math.random() * 2 - 1) * decay
  }

  const src = ctx.createBufferSource()
  src.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  filter.Q.value = 0.7

  const g = ctx.createGain()
  g.gain.value = 0.5

  src.connect(filter).connect(g).connect(dest)
  src.start(t)
}

const playMuffledLaugh = (ctx: AudioContext, dest: AudioNode) => {
  const t = ctx.currentTime
  const pulses = [0, 0.13, 0.28, 0.44, 0.6, 0.78]
  for (const offset of pulses) {
    const dur = 0.14
    const buffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * dur),
      ctx.sampleRate,
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const env = Math.sin((i / data.length) * Math.PI)
      data[i] = (Math.random() * 2 - 1) * env
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 320
    filter.Q.value = 6

    const g = ctx.createGain()
    g.gain.value = 0.35

    src.connect(filter).connect(g).connect(dest)
    src.start(t + offset)
  }
}

/* ------------------------------------------------------------
   Clock helpers
   ------------------------------------------------------------ */

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

/* ------------------------------------------------------------
   Component
   ------------------------------------------------------------ */

export default function App() {
  const [soundOn, setSoundOn] = useState(false)
  const [visibleIndex, setVisibleIndex] = useState(-1)
  const [clockDisplay, setClockDisplay] = useState(() =>
    formatClock(new Date()),
  )
  const [isReturnVisitor, setIsReturnVisitor] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const eventsGainRef = useRef<GainNode | null>(null)
  const ratiosRef = useRef<Map<number, number>>(new Map())
  const lastPlayedIndexRef = useRef(-1)
  const freezeArmedRef = useRef(true)

  const cursorLightRef = useRef<HTMLDivElement>(null)
  const ripplesRef = useRef<HTMLDivElement>(null)

  const clockStateRef = useRef({
    wallMs: Date.now(),
    anchorMs: Date.now(),
    frozen: false,
  })

  /* -- 1. Background gradient drifts with scroll ------------ */
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

  /* -- 2. Reveal each depth section as it enters viewport --- */
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

          if (entry.isIntersecting) {
            el.classList.add('is-visible')
          }
          if (index >= 0) {
            ratiosRef.current.set(index, entry.intersectionRatio)
          }
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
  }, [isReturnVisitor])

  /* -- 3. Cursor light follows pointer ---------------------- */
  useEffect(() => {
    const light = cursorLightRef.current
    if (!light) return

    let raf = 0
    let tx = window.innerWidth / 2
    let ty = window.innerHeight / 2
    let cx = tx
    let cy = ty

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

  /* -- 4. Ripple on click ----------------------------------- */
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

  /* -- 5. Live clock (ticks, then snaps to 03:47) ----------- */
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
    if (visibleIndex < 2) {
      freezeArmedRef.current = true
    }
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

  /* -- 6. Sound layers triggered by depth transitions ------- */
  useEffect(() => {
    if (!soundOn) return
    const ctx = audioCtxRef.current
    const events = eventsGainRef.current
    if (!ctx || !events) return

    const last = lastPlayedIndexRef.current
    if (last === visibleIndex) return
    lastPlayedIndexRef.current = visibleIndex

    if (visibleIndex === 0 && last < 0) {
      playDrip(ctx, events)
    }
    if (visibleIndex === 2 && last < 2) {
      playSplash(ctx, events)
    }
    if (visibleIndex === 4 && last < 4) {
      playMuffledLaugh(ctx, events)
    }
    if (visibleIndex === 5 && last < 5) {
      const master = masterGainRef.current
      if (master) {
        const t = ctx.currentTime
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(master.gain.value, t)
        master.gain.linearRampToValueAtTime(0, t + 4)
        window.setTimeout(() => setSoundOn(false), 4200)
      }
    }
  }, [visibleIndex, soundOn])

  /* -- 7. Return visitor flag (7th depth) ------------------- */
  useEffect(() => {
    try {
      const visited = window.localStorage.getItem('pool-visited')
      if (visited) {
        setIsReturnVisitor(true)
      } else {
        window.localStorage.setItem('pool-visited', '1')
      }
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, [])

  /* -- 8. Sound toggle -------------------------------------- */
  const toggleSound = useCallback(() => {
    const AudioCtor = window.AudioContext
    if (!AudioCtor) return

    if (!audioCtxRef.current) {
      const ctx = new AudioCtor()

      const master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)

      // hum chain — very subtle, low-passed
      const humGain = ctx.createGain()
      humGain.gain.value = 0.02
      humGain.connect(master)

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 240
      filter.Q.value = 0.6
      filter.connect(humGain)

      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 55
      const g1 = ctx.createGain()
      g1.gain.value = 1
      osc1.connect(g1).connect(filter)
      osc1.start()

      const osc2 = ctx.createOscillator()
      osc2.type = 'triangle'
      osc2.frequency.value = 82.4
      const g2 = ctx.createGain()
      g2.gain.value = 0.55
      osc2.connect(g2).connect(filter)
      osc2.start()

      // events chain — for drips, splashes, laughs
      const eventsGain = ctx.createGain()
      eventsGain.gain.value = 0.12
      eventsGain.connect(master)

      audioCtxRef.current = ctx
      masterGainRef.current = master
      eventsGainRef.current = eventsGain
    }

    const ctx = audioCtxRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return

    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)

    if (soundOn) {
      master.gain.linearRampToValueAtTime(0, now + 1.6)
      setSoundOn(false)
    } else {
      master.gain.linearRampToValueAtTime(1, now + 3)
      setSoundOn(true)
      lastPlayedIndexRef.current = visibleIndex
    }
  }, [soundOn, visibleIndex])

  /* -- 9. Cleanup audio on unmount -------------------------- */
  useEffect(() => {
    return () => {
      const ctx = audioCtxRef.current
      audioCtxRef.current = null
      masterGainRef.current = null
      eventsGainRef.current = null
      if (ctx && ctx.state !== 'closed') void ctx.close()
    }
  }, [])

  /* -- 10. Return to surface (random new hero time) --------- */
  const returnToSurface = useCallback(() => {
    clockStateRef.current = {
      wallMs: randomRooftopTime(),
      anchorMs: Date.now(),
      frozen: false,
    }
    freezeArmedRef.current = false
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const depthLabel =
    visibleIndex >= 0 ? String(visibleIndex + 1).padStart(2, '0') : '00'

  return (
    <div className="pool-app">
      <div className="pool-bg" aria-hidden="true" />
      <div className="pool-caustics" aria-hidden="true" />
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

      <main>
        <section className="surface">
          <h1>
            The pool is <em>still open.</em>
          </h1>
          <p className="timestamp">{clockDisplay} · The rooftop</p>
          <p className="surface-note">Scroll to sink</p>

          <div className="scroll-cue" aria-hidden="true">
            <span className="scroll-line" />
            <span>Descend</span>
          </div>
        </section>

        {depths.map((depth, index) => (
          <section
            key={depth.caption}
            className="depth-section"
            data-index={index}
            aria-label={depth.caption}
          >
            <div
              className="depth-image"
              style={{ backgroundImage: `url("${depth.image}")` }}
              aria-hidden="true"
            />
            <div className="depth-veil" aria-hidden="true" />

            <span className="pool-sign" aria-hidden="true">
              {SIGNS[index]}
            </span>

            <div className="depth-text">
              <h2>{depth.line}</h2>
              <p>{depth.caption}</p>
            </div>
          </section>
        ))}

        <section className="depth-section guest-log" data-index={-1}>
          <div className="depth-text guest-log-text">
            <h2>Guest log.</h2>
            <ul>
              {GUEST_LOG.map((g, i) => (
                <li
                  key={g.name + g.date}
                  style={{ transitionDelay: `${1 + i * 0.5}s` }}
                >
                  <span className="log-name">{g.name}</span>
                  <span className="log-dot">·</span>
                  <span className="log-date">{g.date}</span>
                  <span className="log-dot">·</span>
                  <span className="log-note">{g.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {isReturnVisitor && (
          <section className="depth-section depth-seven" data-index={-1}>
            <div className="depth-text">
              <h2>Depth 07 · You came back.</h2>
            </div>
          </section>
        )}

        <footer className="pool-footer">
          <p>
            The Pool at Night ·{' '}
            <span className="depth-counter">{depthLabel}</span> /{' '}
            {String(TOTAL_DEPTHS).padStart(2, '0')}
          </p>
          <button
            type="button"
            className="surface-link"
            onClick={returnToSurface}
          >
            ↑ Surface
          </button>
        </footer>
      </main>
    </div>
  )
}
