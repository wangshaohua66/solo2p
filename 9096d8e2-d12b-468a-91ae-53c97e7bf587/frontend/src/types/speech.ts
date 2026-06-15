export interface SpeechRecognitionResult {
  text: string
  confidence: number
  language: string
  durationMs: number
  alternatives: SpeechAlternative[]
  segments: SpeechSegment[]
}

export interface SpeechAlternative {
  text: string
  confidence: number
}

export interface SpeechSegment {
  text: string
  startTimeMs: number
  endTimeMs: number
  confidence: number
}

export interface SupportedLanguage {
  code: string
  name: string
}

export interface SpeechRecognitionState {
  isRecording: boolean
  isProcessing: boolean
  currentField: string | null
  transcript: string
  confidence: number
  error: string | null
}
