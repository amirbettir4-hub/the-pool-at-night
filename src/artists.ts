/* ============================================================
   THE POOL AT NIGHT — artist registry
   ------------------------------------------------------------
   To add an artist:
     1. Open their submission (GitHub issue or DM)
     2. Copy the block below, fill it in
     3. Paste into this array — order = depth order (1 → 6)
     4. Commit → Vercel rebuilds in ~60s → they're in the pool
   ============================================================ */

export type Artist = {
  name: string
  handle: string
  url: string
  city: string
  medium: string
  /** one small sentence about the work, in their voice */
  note: string
  /** direct image URL — Unsplash, Cloudinary, or /public/your-file.jpg */
  image: string
  /** when they joined */
  since: string
}

export type Slot = {
  /** the pool's headline — stays poetic */
  poolLine: string
  /** the pool's caption under the headline */
  poolCaption: string
  /** the artist occupying this depth */
  artist: Artist
}

/* ------------------------------------------------------------
   THE SIX DEPTHS
   Replace these with real submissions as they come in.
   ------------------------------------------------------------ */

export const slots: Slot[] = [
  {
    poolLine: 'You are still here.',
    poolCaption: 'Depth 01 · The surface was never the surface',
    artist: {
      name: 'Mira Chen',
      handle: '@mirachen',
      url: 'https://example.com/mirachen',
      city: 'Shanghai',
      medium: 'photography',
      note: 'an empty pool, taken at 03:47 — the tiles were still warm',
      image:
        'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?auto=format&fit=crop&w=2200&q=85',
      since: '2024',
    },
  },
  {
    poolLine: 'The water remembers your name.',
    poolCaption: 'Depth 02 · Something is swimming with you',
    artist: {
      name: 'Tobias Vale',
      handle: '@tobiasvale',
      url: 'https://example.com/tobiasvale',
      city: 'Berlin',
      medium: 'oil on canvas',
      note: 'I painted this from memory. I have never been to this pool.',
      image:
        'https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&w=2200&q=85',
      since: '2024',
    },
  },
  {
    poolLine: 'There is a room down here.',
    poolCaption: 'Depth 03 · Its lights are on',
    artist: {
      name: 'Ada Wright',
      handle: '@adawright',
      url: 'https://example.com/adawright',
      city: 'Reykjavík',
      medium: 'field recording',
      note: 'forty seconds of a pool at night, slowed to four hours',
      image:
        'https://images.unsplash.com/photo-1530053969600-caed2596d242?auto=format&fit=crop&w=2200&q=85',
      since: '2024',
    },
  },
  {
    poolLine: 'Someone left the door open.',
    poolCaption: "Depth 04 · You've been here before",
    artist: {
      name: 'Kai Ono',
      handle: '@kaiono',
      url: 'https://example.com/kaiono',
      city: 'Tokyo',
      medium: 'code',
      note: 'a small program that remembers every visitor, then forgets',
      image:
        'https://images.unsplash.com/photo-1518877593221-1f28583780b4?auto=format&fit=crop&w=2200&q=85',
      since: '2024',
    },
  },
  {
    poolLine: 'Keep going.',
    poolCaption: 'Depth 05 · It gets warmer',
    artist: {
      name: 'Sable Rios',
      handle: '@sable',
      url: 'https://example.com/sable',
      city: 'Mexico City',
      medium: 'sculpture',
      note: 'cast in wax — melts slowly at room temperature, never seen whole',
      image:
        'https://images.unsplash.com/photo-1468581264429-2548ef9eb732?auto=format&fit=crop&w=2200&q=85',
      since: '2024',
    },
  },
  {
    poolLine: "You've reached the bottom.",
    poolCaption: 'Depth 06 · There is no bottom',
    artist: {
      name: 'Inès Fournier',
      handle: '@ines',
      url: 'https://example.com/ines',
      city: 'Marseille',
      medium: 'text',
      note: 'I never left. I am still writing from the deep end.',
      image:
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2200&q=85',
      since: '2024',
    },
  },
]

/* ------------------------------------------------------------
   THE ROSTER
   Everyone who has ever swum — shown in the guest log.
   Add past artists here even after they leave the depths.
   ------------------------------------------------------------ */

export type RosterEntry = {
  name: string
  handle: string
  note: string
  date: string
}

export const roster: RosterEntry[] = [
  { name: 'AMY L.', handle: '@amyl', note: 'depth 4', date: '07 / 14 / 1998' },
  { name: 'M. KOWALSKI', handle: '@mkow', note: 'never came back', date: '06 / 02 / 2001' },
  { name: 'T. —', handle: '@t', note: 'left a key', date: '11 / 23 / 2087' },
  { name: 'J. & J.', handle: '@jandj', note: 'still swimming', date: '03 / 03 / 2019' },
  { name: 'MIRA CHEN', handle: '@mirachen', note: 'depth 01', date: '2024' },
  { name: 'TOBIAS VALE', handle: '@tobiasvale', note: 'depth 02', date: '2024' },
  { name: 'ADA WRIGHT', handle: '@adawright', note: 'depth 03', date: '2024' },
  { name: 'KAI ONO', handle: '@kaiono', note: 'depth 04', date: '2024' },
  { name: 'SABLE RIOS', handle: '@sable', note: 'depth 05', date: '2024' },
  { name: 'INÈS FOURNIER', handle: '@ines', note: 'depth 06', date: '2024' },
]

/* ------------------------------------------------------------
   POOL SIGNS — shown on the left edge of each depth
   Replace with gallery-appropriate lingo if you want
   ------------------------------------------------------------ */

export const signs = [
  'NO FLASH PHOTOGRAPHY',
  'GALLERY OPENS 03:47',
  'DO NOT TOUCH THE WATER',
  'SILENCE IS A MEDIUM',
  'THE DEEP END IS OPEN',
  'NO LEAVING',
]

/* ------------------------------------------------------------
   WHISPERS — the pool's voice between depths
   ------------------------------------------------------------ */

export const whispers = [
  'the tile was warm',
  'someone was counting',
  'the light hummed back',
  'it knows your name now',
  "don't turn around",
]

/* ------------------------------------------------------------
   WHERE THE POOL MEETS
   Set these to your repo — used for submissions and community
   ------------------------------------------------------------ */

export const POOL = {
  /** shown in the footer submit link */
  submitUrl:
    'https://github.com/amirbettir4-hub/the-pool-at-night/issues/new?template=artist-submission.yml',
  /** the communal space — GitHub Discussions, Discord, whatever */
  deepEndUrl:
    'https://github.com/amirbettir4-hub/the-pool-at-night/discussions',
  /** total depths shown */
  totalDepths: 6,
}
