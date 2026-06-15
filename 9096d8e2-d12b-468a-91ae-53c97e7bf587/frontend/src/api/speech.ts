import { get, post } from './request'
import type { SpeechRecognitionResult, SupportedLanguage } from '@/types/speech'

export function recognizeSpeech(
  audioBlob: Blob,
  language = 'zh-CN',
  fieldContext?: string
): Promise<SpeechRecognitionResult> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'speech.webm')

  return post<SpeechRecognitionResult>('/speech/recognize', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    params: {
      language,
      fieldContext
    }
  })
}

export function getSupportedLanguages(): Promise<SupportedLanguage[]> {
  return get<SupportedLanguage[]>('/speech/languages')
}

export function getMedicalKeywords(field: string): Promise<string[]> {
  return get<string[]>('/speech/medical-keywords', {
    params: { field }
  })
}

export function postProcessText(
  text: string,
  field?: string
): Promise<{ original: string; processed: string }> {
  return post<{ original: string; processed: string }>('/speech/post-process', null, {
    params: { text, field }
  })
}

export function startStreamSession(
  sessionId: string,
  language = 'zh-CN'
): Promise<{ sessionId: string; status: string; language: string }> {
  return post<{ sessionId: string; status: string; language: string }>(
    '/speech/stream/start',
    null,
    {
      params: { sessionId, language }
    }
  )
}

export function endStreamSession(
  sessionId: string
): Promise<SpeechRecognitionResult> {
  return post<SpeechRecognitionResult>('/speech/stream/end', null, {
    params: { sessionId }
  })
}
