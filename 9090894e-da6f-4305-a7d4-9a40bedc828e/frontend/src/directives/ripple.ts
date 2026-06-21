import type { Directive, DirectiveBinding, App } from 'vue'

interface RippleElement extends HTMLElement {
  _rippleInitialized?: boolean
}

function createRipple(event: MouseEvent, target: HTMLElement) {
  const rect = target.getBoundingClientRect()

  const size = Math.max(rect.width, rect.height) * 2
  const x = event.clientX - rect.left - size / 2
  const y = event.clientY - rect.top - size / 2

  const ripple = document.createElement('span')
  ripple.className = 'ripple-effect'
  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`

  const color = getComputedStyle(target).getPropertyValue('--ripple-color')
  if (color && color.trim()) {
    ripple.style.background = color.trim()
  } else {
    const bgColor = getComputedStyle(target).backgroundColor
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      ripple.style.background = 'rgba(255, 255, 255, 0.35)'
    } else {
      ripple.style.background = 'rgba(64, 158, 255, 0.2)'
    }
  }

  target.appendChild(ripple)

  setTimeout(() => {
    ripple.remove()
  }, 600)
}

const rippleDirective: Directive = {
  mounted(el: RippleElement, binding: DirectiveBinding) {
    if (el._rippleInitialized) return
    el._rippleInitialized = true

    const color = binding.value || 'rgba(255, 255, 255, 0.35)'

    el.style.position = el.style.position || 'relative'
    el.style.overflow = 'hidden'
    el.style.setProperty('--ripple-color', color)

    el.addEventListener('mousedown', (e: MouseEvent) => createRipple(e, el))
  },
  updated(el: RippleElement, binding: DirectiveBinding) {
    const color = binding.value || 'rgba(255, 255, 255, 0.35)'
    el.style.setProperty('--ripple-color', color)
  },
  unmounted(el: RippleElement) {
    delete el._rippleInitialized
  }
}

export function setupGlobalRipple() {
  document.addEventListener(
    'mousedown',
    (event) => {
      const target = event.target as HTMLElement
      const button = target.closest('.el-button, [v-ripple], .ripple-btn') as HTMLElement | null

      if (!button) return
      if (button.classList.contains('is-disabled') || button.getAttribute('disabled') !== null) return

      const computedStyle = getComputedStyle(button)
      if (computedStyle.overflow !== 'hidden') {
        button.style.overflow = 'hidden'
      }
      if (computedStyle.position === 'static') {
        button.style.position = 'relative'
      }

      createRipple(event, button)
    },
    true
  )
}

export function setupRipple(app: App) {
  app.directive('ripple', rippleDirective)
  setupGlobalRipple()
}

export default rippleDirective
