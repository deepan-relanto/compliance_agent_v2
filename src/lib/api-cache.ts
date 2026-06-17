/**
 * Lightweight in-memory server-side cache for expensive API routes.
 * Works in both dev and production Next.js (server components run in Node).
 * Cache lives in the Node process; it is invalidated on writes/mutations.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __apiCache: Map<string, CacheEntry<unknown>> | undefined;
}

function getStore(): Map<string, CacheEntry<unknown>> {
  if (!globalThis.__apiCache) {
    globalThis.__apiCache = new Map();
  }
  return globalThis.__apiCache;
}

/** Read a cached value; returns undefined if missing or expired. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = getStore().get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    getStore().delete(key);
    return undefined;
  }
  return entry.data;
}

/** Write a value to cache with a TTL in seconds (default 45s). */
export function cacheSet<T>(key: string, data: T, ttlSeconds = 45): void {
  getStore().set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** Invalidate one or more cache keys (supports glob-style prefix with '*'). */
export function cacheInvalidate(...keys: string[]): void {
  const store = getStore();
  for (const key of keys) {
    if (key.endsWith("*")) {
      const prefix = key.slice(0, -1);
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) store.delete(k);
      }
    } else {
      store.delete(key);
    }
  }
}

// ── Well-known cache keys ─────────────────────────────────────────────────────
export const CACHE_KEYS = {
  analytics: "analytics:main",
  batches: "batches:list",
  monitoringViolations: (
    page: number,
    statusFilter: string,
    moduleId: string,
    sort: string,
  ) => `monitoring:violations:${page}:${statusFilter}:${moduleId}:${sort}`,
  monitoringReviews: (page: number, statusFilter: string) =>
    `monitoring:reviews:${page}:${statusFilter}`,
  monitoringAudit: (page: number, actionFilter: string) =>
    `monitoring:audit:${page}:${actionFilter}`,
  monitoringSummary: "monitoring:summary",
  batchPerformance: (id: string) => `batch:perf:${id}`,
} as const;
