type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  bucket: string
  key: string
  max: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

const globalStore = globalThis as typeof globalThis & {
  __botainyRateLimitStore?: Map<string, RateLimitEntry>
}

const store = globalStore.__botainyRateLimitStore ?? new Map<string, RateLimitEntry>()
globalStore.__botainyRateLimitStore = store

export function getClientIpFromHeaders(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

export function checkRateLimit({ bucket, key, max, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const scopedKey = `${bucket}:${key}`
  const current = store.get(scopedKey)

  if (!current || now >= current.resetAt) {
    const next: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    }
    store.set(scopedKey, next)
    return {
      allowed: true,
      limit: max,
      remaining: Math.max(0, max - 1),
      resetAt: next.resetAt,
      retryAfterSeconds: 0,
    }
  }

  if (current.count >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return {
      allowed: false,
      limit: max,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds,
    }
  }

  current.count += 1
  store.set(scopedKey, current)

  return {
    allowed: true,
    limit: max,
    remaining: Math.max(0, max - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: 0,
  }
}

export function rateLimitHeaders(result: Pick<RateLimitResult, 'limit' | 'remaining' | 'resetAt'>) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
  }
}
