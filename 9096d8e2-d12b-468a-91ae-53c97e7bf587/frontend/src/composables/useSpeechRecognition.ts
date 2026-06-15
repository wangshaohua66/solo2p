import { ref, computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { recognizeSpeech } from '@/api/speech'
import type { SpeechRecognitionResult } from '@/types/speech'

export function useSpeechRecognition() {
  const isRecording = ref(false)
  const isProcessing = ref(false)
  const currentField = ref<string | null>(null)
  const interimTranscript = ref('')
  const finalTranscript = ref('')
  const confidence = ref(0)
  const error = ref<string | null>(null)

  let recognition: any = null
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let stream: MediaStream | null = null

  const isSupported = computed(() => {
    return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
  })

  const statusText = computed(() => {
    if (isProcessing.value) return '识别中...'
    if (isRecording.value) return '正在录音...'
    if (error.value) return '出错了'
    return '点击开始语音输入'
  })

  function initWebSpeechApi() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'zh-CN'

    rec.onresult = (event: any) => {
      let interim = ''
      let finalText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcript
          confidence.value = event.results[i][0].confidence
        } else {
          interim += transcript
        }
      }

      interimTranscript.value = interim
      if (finalText) {
        finalTranscript.value += finalText
      }
    }

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      error.value = event.error
      isRecording.value = false
      ElMessage.error(`语音识别出错: ${event.error}`)
    }

    rec.onend = () => {
      if (isRecording.value && !error.value) {
        try {
          rec.start()
        } catch (e) {
          console.warn('Failed to restart recognition:', e)
        }
      }
    }

    return rec
  }

  async function startRecording(fieldName: string, fieldContext?: string) {
    if (isRecording.value) return

    currentField.value = fieldName
    error.value = null
    interimTranscript.value = ''
    finalTranscript.value = ''
    confidence.value = 0
    audioChunks = []

    try {
      if (isSupported.value) {
        recognition = initWebSpeechApi()
        if (recognition) {
          recognition.start()
        }
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorder = new MediaRecorder(stream)

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          if (audioChunks.length > 0) {
            await processAudio(fieldContext)
          }
        }

        mediaRecorder.start()
      } catch (e) {
        console.warn('MediaRecorder not available, using Web Speech API only')
      }

      isRecording.value = true
    } catch (e: any) {
      console.error('Failed to start recording:', e)
      error.value = e.message
      ElMessage.error('无法访问麦克风，请检查权限设置')
    }
  }

  async function stopRecording(fieldContext?: string): Promise<string> {
    if (!isRecording.value) return finalTranscript.value

    isRecording.value = false

    if (recognition) {
      try {
        recognition.stop()
      } catch (e) {
        console.warn('Failed to stop recognition:', e)
      }
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }

    if (audioChunks.length > 0) {
      return new Promise((resolve) => {
        const checkResult = setInterval(() => {
          if (finalTranscript.value) {
            clearInterval(checkResult)
            resolve(finalTranscript.value)
          }
        }, 100)

        setTimeout(() => {
          clearInterval(checkResult)
          resolve(finalTranscript.value || interimTranscript.value)
        }, 2000)
      })
    }

    return finalTranscript.value
  }

  async function processAudio(fieldContext?: string): Promise<string> {
    if (audioChunks.length === 0) return ''

    isProcessing.value = true

    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      const result: SpeechRecognitionResult = await recognizeSpeech(audioBlob, 'zh-CN', fieldContext)

      if (result.text) {
        finalTranscript.value = result.text
        confidence.value = result.confidence
      }

      return result.text
    } catch (e: any) {
      console.error('Audio processing failed:', e)
      return finalTranscript.value
    } finally {
      isProcessing.value = false
    }
  }

  function cancelRecording() {
    if (recognition) {
      try {
        recognition.stop()
      } catch (e) {
        console.warn('Failed to stop recognition:', e)
      }
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }

    isRecording.value = false
    isProcessing.value = false
    currentField.value = null
    audioChunks = []
    error.value = null
  }

  function getCurrentText(): string {
    return finalTranscript.value + interimTranscript.value
  }

  onUnmounted(() => {
    cancelRecording()
  })

  return {
    isRecording,
    isProcessing,
    currentField,
    interimTranscript,
    finalTranscript,
    confidence,
    error,
    isSupported,
    statusText,
    startRecording,
    stopRecording,
    cancelRecording,
    getCurrentText
  }
}
