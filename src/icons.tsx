import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

export function IconMenu(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function IconSort(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M4 7h16M4 12h11M4 17h7" />
    </svg>
  )
}

export function IconGear(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  )
}

export function IconBack(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  )
}

export function IconPlus(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconClose(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconList(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M9 7h11M9 12h11M9 17h11M5 7h.01M5 12h.01M5 17h.01" />
    </svg>
  )
}

export function IconImage(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="m8 15 3-3 2 2 2-3 3 4" />
    </svg>
  )
}

export function IconSliders(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M4 8h16M4 16h16M8 6v4M16 14v4" />
    </svg>
  )
}

export function IconLock(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <rect x="6" y="11" width="12" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function IconPin(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M12 15v6M8 4h8l-1 7H9z" />
    </svg>
  )
}

export function IconTrash(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" />
    </svg>
  )
}

export function IconFolder(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M4 7h6l2 2h8v10H4z" />
    </svg>
  )
}

export function IconGrip(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M10 6v12M14 6v12" />
    </svg>
  )
}

export function IconFingerprint(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M7 10a5 5 0 0 1 10 0v4" />
      <path d="M12 7v9" />
      <path d="M9 9.5V16" />
      <path d="M15 9.5V14" />
      <path d="M6 12v3a6 6 0 0 0 12 0" />
    </svg>
  )
}

export function IconMoon(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M18 14a7 7 0 1 1-8-11 7 7 0 0 0 8 11z" />
    </svg>
  )
}

export function IconSun(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  )
}

export function IconPreview(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function IconSearch(p: P) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
