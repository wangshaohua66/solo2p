const DB_NAME = 'tvstation-offline'
const DB_VERSION = 1

export type StoreName =
  | 'pendingUploads'
  | 'cachedMaterials'
  | 'cachedReviews'
  | 'cachedSchedules'
  | 'pendingOperations'
  | 'offlineForms'

interface DBRecord {
  id?: string
  [key: string]: unknown
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('pendingUploads')) {
        const store = db.createObjectStore('pendingUploads', { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }

      if (!db.objectStoreNames.contains('cachedMaterials')) {
        db.createObjectStore('cachedMaterials', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('cachedReviews')) {
        db.createObjectStore('cachedReviews', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('cachedSchedules')) {
        db.createObjectStore('cachedSchedules', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('pendingOperations')) {
        const store = db.createObjectStore('pendingOperations', { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }

      if (!db.objectStoreNames.contains('offlineForms')) {
        db.createObjectStore('offlineForms', { keyPath: 'id' })
      }
    }
  })
}

export async function putRecord(storeName: StoreName, record: DBRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getRecord<T = DBRecord>(
  storeName: StoreName,
  id: string
): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllRecords<T = DBRecord>(storeName: StoreName): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

export async function deleteRecord(storeName: StoreName, id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getByIndex<T = DBRecord>(
  storeName: StoreName,
  indexName: string,
  value: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(value)
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

export interface PendingUpload {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  blob: Blob
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'
  uploadedChunks: number[]
  totalChunks: number
  chunkSize: number
  createdAt: string
  updatedAt: string
  retryCount: number
}

export interface PendingOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: string
  entityId?: string
  data: unknown
  status: 'pending' | 'synced' | 'failed'
  createdAt: string
  retryCount: number
}

export async function savePendingUpload(upload: PendingUpload): Promise<void> {
  await putRecord('pendingUploads', upload as unknown as DBRecord)
}

export async function getPendingUpload(id: string): Promise<PendingUpload | undefined> {
  return getRecord<PendingUpload>('pendingUploads', id)
}

export async function getAllPendingUploads(): Promise<PendingUpload[]> {
  return getAllRecords<PendingUpload>('pendingUploads')
}

export async function deletePendingUpload(id: string): Promise<void> {
  await deleteRecord('pendingUploads', id)
}

export async function getPendingUploadsByStatus(
  status: PendingUpload['status']
): Promise<PendingUpload[]> {
  return getByIndex<PendingUpload>('pendingUploads', 'status', status)
}

export async function savePendingOperation(op: PendingOperation): Promise<void> {
  await putRecord('pendingOperations', op as unknown as DBRecord)
}

export async function getAllPendingOperations(): Promise<PendingOperation[]> {
  return getAllRecords<PendingOperation>('pendingOperations')
}

export async function getPendingOperationsByStatus(
  status: PendingOperation['status']
): Promise<PendingOperation[]> {
  return getByIndex<PendingOperation>('pendingOperations', 'status', status)
}

export async function deletePendingOperation(id: string): Promise<void> {
  await deleteRecord('pendingOperations', id)
}

export async function cacheData(
  storeName: StoreName,
  data: DBRecord | DBRecord[]
): Promise<void> {
  const records = Array.isArray(data) ? data : [data]
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    records.forEach((record) => store.put(record))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCachedData<T = DBRecord>(storeName: StoreName): Promise<T[]> {
  return getAllRecords<T>(storeName)
}

export async function getOfflineStorageInfo(): Promise<{
  pendingUploads: number
  pendingOperations: number
  cachedMaterials: number
  cachedReviews: number
  cachedSchedules: number
}> {
  const [pendingUploads, pendingOperations, cachedMaterials, cachedReviews, cachedSchedules] =
    await Promise.all([
      getAllRecords('pendingUploads'),
      getAllRecords('pendingOperations'),
      getAllRecords('cachedMaterials'),
      getAllRecords('cachedReviews'),
      getAllRecords('cachedSchedules')
    ])

  return {
    pendingUploads: pendingUploads.length,
    pendingOperations: pendingOperations.length,
    cachedMaterials: cachedMaterials.length,
    cachedReviews: cachedReviews.length,
    cachedSchedules: cachedSchedules.length
  }
}

export async function clearAllOfflineData(): Promise<void> {
  const storeNames: StoreName[] = [
    'pendingUploads',
    'pendingOperations',
    'cachedMaterials',
    'cachedReviews',
    'cachedSchedules',
    'offlineForms'
  ]
  await Promise.all(storeNames.map((name) => clearStore(name)))
}
