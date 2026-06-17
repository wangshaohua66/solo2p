import { ref, shallowRef } from 'vue'

export function useAsync<T>(fn: () => Promise<T>, defaultVal: T) {
  const data = shallowRef<T>(defaultVal)
  const loading = ref(true)
  const error = ref<string>('')
  let runId = 0

  async function run() {
    const id = ++runId
    loading.value = true
    error.value = ''
    try {
      const res = await fn()
      if (id === runId) data.value = res as any
    } catch (e: any) {
      if (id === runId) error.value = e?.message || '加载失败'
    } finally {
      if (id === runId) loading.value = false
    }
  }

  run()

  return { data, loading, error, run }
}
