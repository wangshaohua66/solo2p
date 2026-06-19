import { gsap } from 'gsap'
import type { Ref } from 'vue'

export function animateSidebarToggle(
  element: HTMLElement,
  isOpen: Ref<boolean>,
  openWidth = 240,
  duration = 0.3
) {
  return gsap.to(element, {
    width: isOpen.value ? openWidth : 0,
    opacity: isOpen.value ? 1 : 0,
    duration,
    ease: 'power2.inOut'
  })
}

export function animatePanelToggle(
  element: HTMLElement,
  isOpen: boolean,
  duration = 0.3
) {
  return gsap.to(element, {
    flex: isOpen ? '0 0 30%' : '0 0 0',
    opacity: isOpen ? 1 : 0,
    duration,
    ease: 'power2.inOut'
  })
}

export function animateLineHighlight(
  lineElement: HTMLElement,
  duration = 0.25
) {
  return gsap.timeline()
    .fromTo(lineElement, {
      backgroundColor: 'rgba(99, 102, 241, 0)',
      borderLeftWidth: 0
    }, {
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      borderLeftWidth: 3,
      duration,
      ease: 'power2.out'
    })
}

export function animateLineHighlightOut(
  lineElement: HTMLElement,
  duration = 0.2
) {
  return gsap.to(lineElement, {
    backgroundColor: 'rgba(99, 102, 241, 0)',
    borderLeftWidth: 0,
    duration,
    ease: 'power2.in'
  })
}

export function animateFadeInUp(
  element: HTMLElement,
  duration = 0.3,
  delay = 0
) {
  return gsap.fromTo(element, {
    opacity: 0,
    y: 10
  }, {
    opacity: 1,
    y: 0,
    duration,
    delay,
    ease: 'power2.out'
  })
}

export function animateFadeIn(
  element: HTMLElement,
  duration = 0.25
) {
  return gsap.fromTo(element, {
    opacity: 0
  }, {
    opacity: 1,
    duration,
    ease: 'power2.out'
  })
}

export function animateSlideInRight(
  element: HTMLElement,
  duration = 0.3
) {
  return gsap.fromTo(element, {
    x: 20,
    opacity: 0
  }, {
    x: 0,
    opacity: 1,
    duration,
    ease: 'power2.out'
  })
}

export function animateStrokeDraw(
  svgElement: SVGGeometryElement,
  duration = 0.4
) {
  const length = svgElement.getTotalLength()
  gsap.set(svgElement, {
    strokeDasharray: length,
    strokeDashoffset: length
  })
  return gsap.to(svgElement, {
    strokeDashoffset: 0,
    duration,
    ease: 'power2.out'
  })
}

export function animateShake(element: HTMLElement, duration = 0.4) {
  return gsap.to(element, {
    x: -5,
    duration: duration / 8,
    ease: 'power2.inOut',
    yoyo: true,
    repeat: 3
  })
}

export function animatePulse(element: HTMLElement, count = 2) {
  return gsap.to(element, {
    scale: 1.05,
    opacity: 0.8,
    duration: 0.2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: count * 2 - 1
  })
}

export function animateGrowWidth(
  element: HTMLElement,
  targetWidth: number,
  duration = 0.3
) {
  return gsap.fromTo(element, {
    width: 0
  }, {
    width: targetWidth,
    duration,
    ease: 'power2.out'
  })
}

export function killTweensOf(target: any) {
  gsap.killTweensOf(target)
}
