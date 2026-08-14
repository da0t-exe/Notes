const DB_NAME = 'notes-app'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('contents')) db.createObjectStore('contents')
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const os = tx.objectStore(store)
    const req = fn(os)
    tx.oncomplete = () => resolve((req ? req.result : undefined) as T)
    tx.onerror = () => reject(tx.error)
    if (req) {
      req.onerror = () => reject(req.error)
    }
  })
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSet(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    if (key !== undefined) tx.objectStore(store).put(value, key)
    else tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDel(store: string, key: IDBValidKey): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.delete(key))
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return idbGet<T>('kv', key)
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  return idbSet('kv', value, key)
}
