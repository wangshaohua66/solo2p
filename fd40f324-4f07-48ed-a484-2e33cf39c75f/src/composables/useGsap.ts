import { gsap } from 'gsap'

export function useGsap() {
  function fadeInUp(el: HTMLElement | null, options: { delay?: number; duration?: number; y?: number } = {}) {
    if (!el) return
    gsap.fromTo(el,
      { opacity: 0, y: options.y ?? 16 },
      { opacity: 1, y: 0, duration: options.duration ?? 0.35, delay: options.delay ?? 0, ease: 'power2.out' }
    )
  }

  function fadeIn(el: HTMLElement | null, options: { delay?: number; duration?: number } = {}) {
    if (!el) return
    gsap.fromTo(el,
      { opacity: 0 },
      { opacity: 1, duration: options.duration ?? 0.25, delay: options.delay ?? 0, ease: 'power2.out' }
    )
  }

  function slideIn(el: HTMLElement | null, direction: 'left' | 'right' | 'up' | 'down' = 'left', duration = 0.3) {
    if (!el) return
    const fromVars: Record<string, number> = { opacity: 0 }
    if (direction === 'left') fromVars.x = -32
    if (direction === 'right') fromVars.x = 32
    if (direction === 'up') fromVars.y = -32
    if (direction === 'down') fromVars.y = 32
    gsap.fromTo(el, fromVars, { opacity: 1, x: 0, y: 0, duration, ease: 'power2.inOut' })
  }

  function slideOut(el: HTMLElement | null, direction: 'left' | 'right' | 'up' | 'down' = 'right', duration = 0.25) {
    if (!el) return
    const toVars: gsap.TweenVars = { opacity: 0, duration, ease: 'power2.inOut' }
    if (direction === 'left') toVars.x = -32
    if (direction === 'right') toVars.x = 32
    if (direction === 'up') toVars.y = -32
    if (direction === 'down') toVars.y = 32
    gsap.to(el, toVars)
  }

  function pulse(el: HTMLElement | null, scale = 1.08) {
    if (!el) return
    gsap.fromTo(el,
      { scale: 1 },
      { scale, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut', transformOrigin: 'center' }
    )
  }

  function lineHighlight(el: HTMLElement | null) {
    if (!el) return
    gsap.fromTo(el,
      { opacity: 0.3, scaleX: 0.96 },
      { opacity: 1, scaleX: 1, duration: 0.18, ease: 'power2.out', transformOrigin: 'left center' }
    )
  }

  function panelExpand(el: HTMLElement | null, width: number) {
    if (!el) return
    gsap.fromTo(el,
      { width: 0, opacity: 0.4 },
      { width, opacity: 1, duration: 0.3, ease: 'power2.inOut' }
    )
  }

  function staggerEnter(els: HTMLElement[], options: { delay?: number; stagger?: number } = {}) {
    if (!els.length) return
    gsap.fromTo(els,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.3, delay: options.delay ?? 0, stagger: options.stagger ?? 0.06, ease: 'power2.out' }
    )
  }

  return {
    gsap,
    fadeInUp,
    fadeIn,
    slideIn,
    slideOut,
    pulse,
    lineHighlight,
    panelExpand,
    staggerEnter
  }
}

export type GsapAPI = ReturnType<typeof useGsap>
