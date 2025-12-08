import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let initialized = false;

/**
 * Initialize Redis client for production rate limiting.
 * Falls back to in-memory store if Redis is unavailable.
 */
export async function initializeRateLimiter() {
  if (initialized) return;

  if (process.env.REDIS_URL) {
    try {
      const redisUrl = new URL(process.env.REDIS_URL);
      redisClient = createClient({
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || "0"),
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      });

      redisClient.on("error", (err) =>
        console.error("Redis Client Error", err),
      );
      redisClient.on("connect", () => console.log("Redis Client Connected"));

      await redisClient.connect();
      console.log("Redis rate limiter initialized");
    } catch (error) {
      console.warn(
        "Failed to connect to Redis, falling back to in-memory rate limiter:",
        error,
      );
      redisClient = null;
    }
  }

  initialized = true;
}

/**
 * In-memory rate limit store (fallback for development)
 */
const inMemoryStore = new Map<
  string,
  Array<{ timestamp: number; weight: number }>
>();

/**
 * Check rate limit and return remaining requests
 * @param key - Unique identifier (userId, IP, etc.)
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @param weight - Weight of this request (default 1)
 * @returns { allowed: boolean, remaining: number, resetTime: number }
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 60000,
  weight: number = 1,
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}> {
  if (redisClient) {
    return checkRateLimitRedis(redisClient, key, maxRequests, windowMs, weight);
  } else {
    return checkRateLimitMemory(key, maxRequests, windowMs, weight);
  }
}

/**
 * Redis-based rate limiting using sliding window
 */
async function checkRateLimitRedis(
  client: RedisClientType,
  key: string,
  maxRequests: number,
  windowMs: number,
  weight: number,
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}> {
  const redisKey = `ratelimit:${key}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Use Redis sorted set with timestamps as scores
    // Remove old entries outside the window
    await client.zRemRangeByScore(redisKey, "-inf", windowStart);

    // Get current request count in window
    const count = await client.zCard(redisKey);
    const currentWeight = count || 0;

    if (currentWeight + weight > maxRequests) {
      // Get the oldest request timestamp to calculate retry-after
      const oldest = await client.zRange(redisKey, 0, 0);
      let retryAfter = 0;

      if (oldest && oldest.length > 0) {
        const oldestTime = parseInt(oldest[0]);
        retryAfter = Math.ceil((windowMs - (now - oldestTime)) / 1000);
      }

      // Set expiry to clean up old entries
      await client.expire(redisKey, Math.ceil(windowMs / 1000));

      return {
        allowed: false,
        remaining: 0,
        resetTime: now + retryAfter * 1000,
        retryAfter,
      };
    }

    // Add current request with timestamp
    await client.zAdd(redisKey, {
      score: now,
      member: `${now}-${Math.random()}`,
    });

    // Set key expiry
    await client.expire(redisKey, Math.ceil(windowMs / 1000));

    return {
      allowed: true,
      remaining: maxRequests - (currentWeight + weight),
      resetTime: now + windowMs,
    };
  } catch (error) {
    console.error("Redis rate limit check failed:", error);
    // Fail open - allow request if Redis is down
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: now + windowMs,
    };
  }
}

/**
 * In-memory rate limiting using sliding window
 */
function checkRateLimitMemory(
  key: string,
  maxRequests: number,
  windowMs: number,
  weight: number,
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get or create entry
  let requests = inMemoryStore.get(key) || [];

  // Remove old requests
  requests = requests.filter((req) => req.timestamp > windowStart);

  // Calculate total weight
  const totalWeight = requests.reduce((sum, req) => sum + req.weight, 0);

  if (totalWeight + weight > maxRequests) {
    const oldestRequest = requests[0];
    const retryAfter = Math.ceil(
      (windowMs - (now - oldestRequest.timestamp)) / 1000,
    );

    inMemoryStore.set(key, requests);

    return {
      allowed: false,
      remaining: 0,
      resetTime: now + retryAfter * 1000,
      retryAfter,
    };
  }

  // Add new request
  requests.push({ timestamp: now, weight });
  inMemoryStore.set(key, requests);

  return {
    allowed: true,
    remaining: maxRequests - (totalWeight + weight),
    resetTime: now + windowMs,
  };
}

/**
 * Reset rate limit for a specific key (admin action)
 */
export async function resetRateLimit(key: string): Promise<void> {
  if (redisClient) {
    await redisClient.del(`ratelimit:${key}`);
  } else {
    inMemoryStore.delete(key);
  }
}

/**
 * Get rate limit status for monitoring
 */
export async function getRateLimitStatus(
  key: string,
): Promise<{ currentUsage: number; timestamp: number } | null> {
  if (redisClient) {
    const count = await redisClient.zCard(`ratelimit:${key}`);
    return { currentUsage: count || 0, timestamp: Date.now() };
  } else {
    const requests = inMemoryStore.get(key) || [];
    return {
      currentUsage: requests.reduce((sum, req) => sum + req.weight, 0),
      timestamp: Date.now(),
    };
  }
}

/**
 * Cleanup rate limiter (for graceful shutdown)
 */
export async function closeRateLimiter(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  inMemoryStore.clear();
  initialized = false;
}
