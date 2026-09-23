// Results are deterministic (same inputs, same weather file, same answer),
// so they are cached. A Map keeps insertion order, which is all an LRU
// needs: re-inserting on read moves an entry to the young end.

export class LruCache {
  constructor({ max = 500, ttlMs = 24 * 3600 * 1000, now = () => Date.now() } = {}) {
    this.max = max
    this.ttlMs = ttlMs
    this.now = now
    this.map = new Map()
  }

  get(key) {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (this.now() - hit.at > this.ttlMs) { this.map.delete(key); return undefined }
    this.map.delete(key)
    this.map.set(key, hit)
    return hit.value
  }

  set(key, value) {
    this.map.delete(key)
    this.map.set(key, { value, at: this.now() })
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value)
  }

  get size() { return this.map.size }
}

/** Identical requests in flight share one engine call. */
export function coalescer() {
  const inflight = new Map()
  return function once(key, fn) {
    if (inflight.has(key)) return inflight.get(key)
    const p = Promise.resolve().then(fn).finally(() => inflight.delete(key))
    inflight.set(key, p)
    return p
  }
}
