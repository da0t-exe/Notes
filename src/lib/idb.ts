const DB_NAME = 'notes-app'
const DB_VERSION = 1
const STORES = ['notes', 'contents', 'handles', 'kv'] as const

export type StoreName = (typeof STORES)[number]

// v0.3 called indexedDB.open() on every single get and set. Holding one
// connection turns each access back into a plain transaction.
let connection: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, name === 'notes' ? { keyPath: 'id' } : undefined)
        }
      }
    }
    req.onsuccess = () => {
      // A version change from another tab invalidates this handle.
      req.result.onclose = () => {
        connection = null
      }
      resolve(req.result)
    }
    req.onerror = () => {
      connection = null
      reject(req.error ?? new Error('Could not open the database'))
    }
  })
  return connection
}

export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function idbSet(store: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const target = tx.objectStore(store)
    if (key === undefined) target.put(value)
    else target.put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDel(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function kvGet<T>(key: string): Promise<T | undefined> {
  return idbGet<T>('kv', key)
}

export function kvSet(key: string, value: unknown): Promise<void> {
  return idbSet('kv', value, key)
}
