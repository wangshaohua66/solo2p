import { ref, onMounted, watch } from 'vue'

export function useCountUp(target: () => number, duration = 1200) {
  const display = ref(0)
  let raf = 0

  function run(to: number) {
    cancelAnimationFrame(raf)
    const from = display.value
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      display.value = from + (to - from) * eased
      if (p < 1) raf = requestAnimationFrame(step)
      else display.value = to
    }
    raf = requestAnimationFrame(step)
  }

  onMounted(() => run(target()))
  watch(target, (v) => run(v))

  return display
}
