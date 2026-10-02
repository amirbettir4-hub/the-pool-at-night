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

const TOTAL_DEPTHS = depths.length

export default function App() {
  const [soundOn, setSoundOn] = useState(false)
  const [visibleIndex, setVisibleIndex] = useState(-1)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const ratiosRef = useRef<Map<number, number>>(new Map())

  /* ------------------------------------------------------------
     1. Background gradient drifts with scroll position
     ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     2. Reveal each depth section as it enters the viewport
     ------------------------------------------------------------ */
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('.depth-section'),
    )

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement
          const index = Number(el.dataset.index ?? '0')

          if (entry.isIntersecting) {
            el.classList.add('is-visible')
          }

          ratiosRef.current.set(index, entry.intersectionRatio)
        }

        // the "current depth" is whichever section owns the most screen
        let best = -1
        let bestRatio = 0

        ratiosRef.current.forEach((ratio, index) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = index
          }
        })

        if (best !== -1) {
          setVisibleIndex(best)
        }
      },
      {
        threshold: [0, 0.15, 0.35, 0.55, 0.75, 0.95],
        rootMargin: '-4% 0px -4% 0px',
      },
    )

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [])

  /* ------------------------------------------------------------
     3. Audio: two low oscillators through a 240Hz lowpass
     ------------------------------------------------------------ */
  const toggleSound = useCallback(() => {
    const AudioCtor = window.AudioContext

    if (!AudioCtor) return

    if (!audioCtxRef.current) {
      const ctx = new AudioCtor()

      const master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 240
      filter.Q.value = 0.6
      filter.connect(master)

      // 55 Hz — the deep body of the hum
      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 55
      const gain1 = ctx.createGain()
      gain1.gain.value = 1
      osc1.connect(gain1).connect(filter)
      osc1.start()

      // 82.4 Hz — a faint, colder overtone
      const osc2 = ctx.createOscillator()
      osc2.type = 'triangle'
      osc2.frequency.value = 82.4
      const gain2 = ctx.createGain()
      gain2.gain.value = 0.55
      osc2.connect(gain2).connect(filter)
      osc2.start()

      audioCtxRef.current = ctx
      masterGainRef.current = master
    }

    const ctx = audioCtxRef.current
    const master = masterGainRef.current

    if (!ctx || !master) return

    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)

    if (soundOn) {
      master.gain.linearRampToValueAtTime(0, now + 1.6)
      setSoundOn(false)
    } else {
      master.gain.linearRampToValueAtTime(0.02, now + 3)
      setSoundOn(true)
    }
  }, [soundOn])

  /* ------------------------------------------------------------
     4. Clean up audio on unmount
     ------------------------------------------------------------ */
  useEffect(() => {
    return () => {
      const ctx = audioCtxRef.current
      audioCtxRef.current = null
      masterGainRef.current = null

      if (ctx && ctx.state !== 'closed') {
        void ctx.close()
      }
    }
  }, [])

  const depthLabel =
    visibleIndex >= 0
      ? String(visibleIndex + 1).padStart(2, '0')
      : '00'

  return (
    <div className="pool-app">
      <div className="pool-bg" aria-hidden="true" />
      <div className="pool-caustics" aria-hidden="true" />
      <div className="pool-grain" aria-hidden="true" />

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
          <p className="timestamp">03:47 AM · The rooftop</p>
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

            <div className="depth-text">
              <h2>{depth.line}</h2>
              <p>{depth.caption}</p>
            </div>
          </section>
        ))}

        <footer className="pool-footer">
          <p>
            The Pool at Night ·{' '}
            <span className="depth-counter">{depthLabel}</span> /{' '}
            {String(TOTAL_DEPTHS).padStart(2, '0')}
          </p>
        </footer>
      </main>
    </div>
  )
}
