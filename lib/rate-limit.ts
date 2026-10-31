// Simple in-memory rate limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

export function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Reset window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: maxRequests - 1,
      limit: maxRequests,
      resetTime: new Date(now + windowMs),
    };
  }

  if (entry.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      limit: maxRequests,
      resetTime: new Date(entry.resetTime),
    };
  }

  entry.count++;
  return {
    success: true,
    remaining: maxRequests - entry.count,
    limit: maxRequests,
    resetTime: new Date(entry.resetTime),
  };
}

// Preset limits
export const LIMITS = {
  AUTH: { max: 5, window: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  API: { max: 100, window: 60 * 1000 }, // 100 requests per minute
};
