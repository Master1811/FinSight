/**
 * Cache helper with Redis backend, key prefixing, TTL management, and stale-while-revalidate
 */

import { Redis } from '@upstash/redis';
import { redisUrl } from '../config';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export interface CacheConfig {
  enabled: boolean;
  defaultTtl: number; // seconds
  staleWhileRevalidate: boolean;
  staleTtl: number; // seconds
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  defaultTtl: 300, // 5 minutes
  staleWhileRevalidate: true,
  staleTtl: 3600, // 1 hour
};

// TTL configurations for different data domains
export const CACHE_TTL_MAP = {
  // Financial data - shorter TTL for freshness
  'equity:live': 60, // 1 minute
  'equity:history': 900, // 15 minutes
  'equity:info': 3600, // 1 hour

  // Mutual fund data
  'mf:nav': 1800, // 30 minutes
  'mf:history': 3600, // 1 hour
  'mf:search': 7200, // 2 hours

  // Macro economic data - longer TTL
  'macro:data': 21600, // 6 hours
  'macro:inflation': 43200, // 12 hours

  // LLM responses - cache for cost optimization
  'llm:response': 7200, // 2 hours

  // Default fallback
  default: 300, // 5 minutes
} as const;

// ============================================================================
// CACHE ENTRY TYPES
// ============================================================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number; // Unix timestamp
  ttl: number; // TTL in seconds
  source: string;
  isStale?: boolean;
  metadata?: Record<string, any>;
}

export interface CacheResult<T = any> {
  data: T;
  isStale: boolean;
  source: string;
  cachedAt: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// REDIS CACHE IMPLEMENTATION
// ============================================================================

class RedisCache {
  private redis: Redis;
  private config: CacheConfig;

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config;

    if (!redisUrl()) {
      throw new Error('Redis URL not configured');
    }

    this.redis = new Redis({
      url: redisUrl(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
  }

  /**
   * Generate cache key with prefix
   */
  private getCacheKey(domain: string, key: string): string {
    return `finsight:${domain}:${key}`;
  }

  /**
   * Get TTL for a domain
   */
  private getTtl(domain: string): number {
    return CACHE_TTL_MAP[domain as keyof typeof CACHE_TTL_MAP] || CACHE_TTL_MAP.default;
  }

  /**
   * Set cache entry
   */
  async set<T>(
    domain: string,
    key: string,
    data: T,
    options: {
      ttl?: number;
      source?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    const ttl = options.ttl || this.getTtl(domain);
    const cacheKey = this.getCacheKey(domain, key);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      source: options.source || 'unknown',
      metadata: options.metadata,
    };

    try {
      await this.redis.setex(cacheKey, ttl, JSON.stringify(entry));
    } catch (error) {
      console.warn('Cache set failed:', error);
      // Don't throw - cache failures shouldn't break the app
    }
  }

  /**
   * Get cache entry
   */
  async get<T>(domain: string, key: string): Promise<CacheResult<T> | null> {
    if (!this.config.enabled) return null;

    const cacheKey = this.getCacheKey(domain, key);

    try {
      const cached = await this.redis.get<string>(cacheKey);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();
      const age = (now - entry.timestamp) / 1000; // age in seconds
      const isExpired = age > entry.ttl;
      const isStale = this.config.staleWhileRevalidate && age > (entry.ttl * 0.8); // 80% of TTL

      // If expired and not using stale-while-revalidate, return null
      if (isExpired && !this.config.staleWhileRevalidate) {
        return null;
      }

      return {
        data: entry.data,
        isStale: isExpired || isStale,
        source: entry.source,
        cachedAt: entry.timestamp,
        expiresAt: entry.timestamp + (entry.ttl * 1000),
        metadata: entry.metadata,
      };
    } catch (error) {
      console.warn('Cache get failed:', error);
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(domain: string, key: string): Promise<void> {
    if (!this.config.enabled) return;

    const cacheKey = this.getCacheKey(domain, key);

    try {
      await this.redis.del(cacheKey);
    } catch (error) {
      console.warn('Cache delete failed:', error);
    }
  }

  /**
   * Clear all cache entries for a domain
   */
  async clearDomain(domain: string): Promise<void> {
    if (!this.config.enabled) return;

    const pattern = `finsight:${domain}:*`;

    try {
      // Note: Upstash Redis doesn't support SCAN, so we can't efficiently clear by pattern
      // This is a limitation - in production, consider using Redis namespaces or manual key tracking
      console.warn('Domain clearing not supported with Upstash Redis - manual cleanup required');
    } catch (error) {
      console.warn('Cache clear domain failed:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    config: CacheConfig;
  }> {
    return {
      enabled: this.config.enabled,
      config: this.config,
    };
  }
}

// ============================================================================
// CACHE HELPER FUNCTIONS
// ============================================================================

// Singleton cache instance
let cacheInstance: RedisCache | null = null;

export function getCache(): RedisCache {
  if (!cacheInstance) {
    cacheInstance = new RedisCache();
  }
  return cacheInstance;
}

/**
 * Cached function wrapper with automatic key generation
 */
export function withCache<TArgs extends any[], TResult>(
  domain: string,
  fn: (...args: TArgs) => Promise<{ data: TResult; source: string; metadata?: any }>,
  options: {
    keyFn?: (...args: TArgs) => string;
    ttl?: number;
  } = {}
) {
  return async (...args: TArgs): Promise<{ data: TResult; source: string; isStale?: boolean; metadata?: any }> => {
    const cache = getCache();
    const key = options.keyFn ? options.keyFn(...args) : JSON.stringify(args);
    const ttl = options.ttl;

    // Try cache first
    const cached = await cache.get<TResult>(domain, key);
    if (cached && !cached.isStale) {
      return {
        data: cached.data,
        source: cached.source,
        isStale: false,
        metadata: cached.metadata,
      };
    }

    // Cache miss or stale - call function
    try {
      const result = await fn(...args);

      // Cache the result
      await cache.set(domain, key, result.data, {
        ttl,
        source: result.source,
        metadata: result.metadata,
      });

      return {
        data: result.data,
        source: result.source,
        isStale: cached?.isStale || false, // Return stale data if available
        metadata: result.metadata,
      };
    } catch (error) {
      // If we have stale data, return it
      if (cached?.isStale) {
        return {
          data: cached.data,
          source: cached.source,
          isStale: true,
          metadata: cached.metadata,
        };
      }
      throw error;
    }
  };
}

/**
 * Invalidate cache for a specific key
 */
export async function invalidateCache(domain: string, key: string): Promise<void> {
  const cache = getCache();
  await cache.delete(domain, key);
}

/**
 * Clear entire domain cache
 */
export async function clearDomainCache(domain: string): Promise<void> {
  const cache = getCache();
  await cache.clearDomain(domain);
}