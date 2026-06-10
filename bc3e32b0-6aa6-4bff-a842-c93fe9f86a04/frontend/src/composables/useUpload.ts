import { ref, computed } from 'vue'
import { uploadApi } from '@/api'

export function useUpload() {
  const isUploading = ref(false)
  const progress = ref(0)
  const uploadedFiles = ref<any[]>([])

  const isComplete = computed(() => !isUploading.value && uploadedFiles.value.length > 0)

  const generateThumbnail = async (file: File, maxWidth: number = 400): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'))
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ratio = maxWidth / img.width
          const width = maxWidth
          const height = img.height * ratio

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Cannot get canvas context'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/webp', 0.8))
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const uploadImage = async (file: File, category: string = 'general') => {
    isUploading.value = true
    progress.value = 0

    try {
      const result = await uploadApi.uploadImage(file, category)
      uploadedFiles.value.push(result)
      progress.value = 100
      return result
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    } finally {
      isUploading.value = false
    }
  }

  const uploadChunked = async (file: File, category: string = 'general') => {
    const CHUNK_SIZE = 2 * 1024 * 1024
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    isUploading.value = true
    progress.value = 0

    try {
      const initResult: any = await uploadApi.initChunkUpload(file.name, file.size)
      const uploadId = initResult.uploadId || initResult.data?.uploadId

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)

        await uploadApi.uploadChunk(chunk, i, totalChunks, uploadId)
        progress.value = Math.round(((i + 1) / totalChunks) * 100)
      }

      const result = await uploadApi.completeChunkUpload(uploadId)
      uploadedFiles.value.push(result)
      return result
    } catch (error) {
      console.error('Chunked upload failed:', error)
      throw error
    } finally {
      isUploading.value = false
    }
  }

  const validateFile = (file: File, maxSizeMB: number = 8): boolean => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      console.error(`File size exceeds ${maxSizeMB}MB limit`)
      return false
    }

    if (!file.type.startsWith('image/')) {
      console.error('Only image files are allowed')
      return false
    }

    return true
  }

  const reset = () => {
    isUploading.value = false
    progress.value = 0
    uploadedFiles.value = []
  }

  return {
    isUploading,
    progress,
    uploadedFiles,
    isComplete,
    generateThumbnail,
    uploadImage,
    uploadChunked,
    validateFile,
    reset
  }
}
