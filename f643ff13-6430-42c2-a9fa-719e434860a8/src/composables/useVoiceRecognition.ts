import { ref, onUnmounted } from 'vue'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export function useVoiceRecognition() {
  const isListening = ref(false)
  const isSupported = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref<string | null>(null)

  let recognition: SpeechRecognition | null = null

  const initRecognition = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      isSupported.value = false
      return false
    }

    isSupported.value = true
    recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        transcript.value += final
      }
      interimTranscript.value = interim
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      error.value = event.message
      isListening.value = false
    }

    recognition.onend = () => {
      if (isListening.value) {
        try {
          recognition?.start()
        } catch (e) {
          console.error('Failed to restart recognition:', e)
        }
      }
    }

    recognition.onstart = () => {
      isListening.value = true
      error.value = null
    }

    return true
  }

  const startListening = () => {
    if (!recognition) {
      const supported = initRecognition()
      if (!supported) {
        error.value = '浏览器不支持语音识别功能'
        return false
      }
    }

    if (isListening.value) return true

    transcript.value = ''
    interimTranscript.value = ''
    error.value = null

    try {
      recognition?.start()
      return true
    } catch (e) {
      error.value = '启动语音识别失败'
      return false
    }
  }

  const stopListening = () => {
    isListening.value = false
    try {
      recognition?.stop()
    } catch (e) {
      console.error('Failed to stop recognition:', e)
    }
  }

  const resetTranscript = () => {
    transcript.value = ''
    interimTranscript.value = ''
  }

  const getFullTranscript = () => {
    return transcript.value + interimTranscript.value
  }

  onUnmounted(() => {
    stopListening()
    recognition = null
  })

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    initRecognition,
    startListening,
    stopListening,
    resetTranscript,
    getFullTranscript
  }
}
