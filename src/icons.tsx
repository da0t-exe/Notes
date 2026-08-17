import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

function I({ d, box = '0 0 24 24', children, ...p }: P & { d?: string; box?: string }) {
  return (
    <svg {...p} viewBox={box}>
      {d ? <path d={d} /> : children}
    </svg>
  )
}

export const IconMenu = (p: P) => <I d="M4 7h16M4 12h16M4 17h16" {...p} />
export const IconPanel = (p: P) => (
  <I {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M10 5v14" />
  </I>
)
export const IconSort = (p: P) => <I d="M4 7h16M4 12h11M4 17h7" {...p} />
export const IconGear = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </I>
)
export const IconBack = (p: P) => <I d="M15 5 8 12l7 7" {...p} />
export const IconPlus = (p: P) => <I d="M12 5v14M5 12h14" {...p} />
export const IconClose = (p: P) => <I d="M6 6l12 12M18 6 6 18" {...p} />
export const IconList = (p: P) => <I d="M9 7h11M9 12h11M9 17h11M5 7h.01M5 12h.01M5 17h.01" {...p} />
export const IconImage = (p: P) => (
  <I {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="m8 15 3-3 2 2 2-3 3 4" />
  </I>
)
export const IconLock = (p: P) => (
  <I {...p}>
    <rect x="6" y="11" width="12" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </I>
)
export const IconPin = (p: P) => <I d="M12 15v6M8 4h8l-1 7H9z" {...p} />
export const IconTrash = (p: P) => <I d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" {...p} />
export const IconFolder = (p: P) => <I d="M4 7h6l2 2h8v10H4z" {...p} />
export const IconGrip = (p: P) => <I d="M10 6v12M14 6v12" {...p} />
export const IconFingerprint = (p: P) => (
  <I {...p}>
    <path d="M7 10a5 5 0 0 1 10 0v4" />
    <path d="M12 7v9" />
    <path d="M9 9.5V16" />
    <path d="M15 9.5V14" />
    <path d="M6 12v3a6 6 0 0 0 12 0" />
  </I>
)
export const IconPreview = (p: P) => (
  <I {...p}>
    <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
    <circle cx="12" cy="12" r="2.5" />
  </I>
)
export const IconBold = (p: P) => <I d="M7 5h7a4 4 0 0 1 0 8H7zM7 13h8a4 4 0 0 1 0 8H7z" {...p} />
export const IconItalic = (p: P) => <I d="M15 5H9M13 19H7M14 5l-4 14" {...p} />
export const IconStrike = (p: P) => <I d="M5 12h14M16 7a4 4 0 0 0-8 .8M8 17a4 4 0 0 0 8-.8" {...p} />
export const IconHeading = (p: P) => <I d="M6 5v14M18 5v14M6 12h12" {...p} />
export const IconQuote = (p: P) => <I d="M7 17c2-3 3-5 3-8H6v5h4M17 17c2-3 3-5 3-8h-4v5h4" {...p} />
export const IconCode = (p: P) => <I d="m8 8-4 4 4 4M16 8l4 4-4 4" {...p} />
export const IconRestore = (p: P) => <I d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" {...p} />
export const IconCopy = (p: P) => (
  <I {...p}>
    <rect x="8" y="8" width="11" height="13" rx="2" />
    <path d="M5 16V5a2 2 0 0 1 2-2h9" />
  </I>
)
export const IconCamera = (p: P) => (
  <I {...p}>
    <path d="M4 8h4l1.5-2h5L16 8h4v11H4z" />
    <circle cx="12" cy="13" r="3" />
  </I>
)
export const IconChevron = (p: P) => <I d="m9 6 6 6-6 6" {...p} />
export const IconExternal = (p: P) => <I d="M10 6h8v8M18 6l-9 9M6 8v10h10" {...p} />
export const IconNote = (p: P) => (
  <I {...p}>
    <rect x="5" y="4" width="14" height="16" rx="2" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </I>
)
export function IconRadio({ on, ...p }: P & { on?: boolean }) {
  return (
    <I {...p}>
      <circle cx="12" cy="12" r="8" />
      {on ? <circle cx="12" cy="12" r="4" fill="currentColor" /> : null}
    </I>
  )
}
export const IconWinMin = (p: P) => <I box="0 0 12 12" d="M2.5 6h7" {...p} />
export const IconWinMax = (p: P) => (
  <I box="0 0 12 12" {...p}>
    <rect x="2.4" y="2.4" width="7.2" height="7.2" rx="1.4" />
  </I>
)
export const IconWinRestore = (p: P) => (
  <I box="0 0 12 12" {...p}>
    <path d="M4.4 3.2h4.4v4.4" />
    <rect x="2.4" y="4.4" width="5.2" height="5.2" rx="1.2" />
  </I>
)
export const IconWinClose = (p: P) => <I box="0 0 12 12" d="M3.2 3.2l5.6 5.6M8.8 3.2 3.2 8.8" {...p} />
