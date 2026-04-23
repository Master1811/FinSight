/**
 * Graceful degradation utilities for provider responses
 */

import { ProviderResult } from './provider.types';

// ============================================================================
// DEGRADED RESPONSE TYPES
// ============================================================================

export interface DegradedResponse<T = any> {
  data: T;
  asOf: string; // ISO timestamp
  isStale: boolean;
  source: string;
  degradedReason?: string;
  metadata?: Record<string, any>;
}

export type DegradationLevel = 'none' | 'stale' | 'fallback' | 'cached' | 'error';

// ============================================================================
// DEGRADATION UTILITIES
// ============================================================================

/**
 * Create a successful (non-degraded) response
 */
export function successResponse<T>(
  data: T,
  source: string,
  metadata?: Record<string, any>
): DegradedResponse<T> {
  return {
    data,
    asOf: new Date().toISOString(),
    isStale: false,
    source,
    metadata,
  };
}

/**
 * Create a stale response (data is old but still usable)
 */
export function staleResponse<T>(
  data: T,
  source: string,
  asOf?: string,
  metadata?: Record<string, any>
): DegradedResponse<T> {
  return {
    data,
    asOf: asOf || new Date().toISOString(),
    isStale: true,
    source,
    degradedReason: 'Data is stale but still available',
    metadata,
  };
}

/**
 * Create a fallback response (using alternative data source)
 */
export function fallbackResponse<T>(
  data: T,
  source: string,
  originalSource: string,
  reason?: string,
  metadata?: Record<string, any>
): DegradedResponse<T> {
  return {
    data,
    asOf: new Date().toISOString(),
    isStale: false,
    source,
    degradedReason: `Using fallback source (${source}) instead of ${originalSource}${reason ? `: ${reason}` : ''}`,
    metadata,
  };
}

/**
 * Create a cached response (data from cache, may be stale)
 */
export function cachedResponse<T>(
  data: T,
  source: string,
  cachedAt: string,
  isStale: boolean = false,
  metadata?: Record<string, any>
): DegradedResponse<T> {
  return {
    data,
    asOf: cachedAt,
    isStale,
    source: `${source} (cached)`,
    degradedReason: isStale ? 'Serving stale cached data' : 'Serving cached data',
    metadata,
  };
}

/**
 * Create an error response (no data available)
 */
export function errorResponse<T>(
  fallbackData: T | null,
  source: string,
  error: string,
  metadata?: Record<string, any>
): DegradedResponse<T | null> {
  return {
    data: fallbackData,
    asOf: new Date().toISOString(),
    isStale: true,
    source,
    degradedReason: `Error: ${error}`,
    metadata,
  };
}

// ============================================================================
// PROVIDER RESULT NORMALIZATION
// ============================================================================

/**
 * Normalize any ProviderResult to DegradedResponse format
 */
export function normalizeProviderResult<T>(
  result: ProviderResult<T>,
  degradationLevel: DegradationLevel = 'none'
): DegradedResponse<T> {
  const baseResponse: DegradedResponse<T> = {
    data: result.data,
    asOf: result.asOf,
    isStale: result.isStale || false,
    source: result.source,
    metadata: result.metadata,
  };

  // Add degradation reason based on level
  switch (degradationLevel) {
    case 'stale':
      baseResponse.degradedReason = 'Data is stale but still usable';
      baseResponse.isStale = true;
      break;
    case 'fallback':
      baseResponse.degradedReason = 'Using fallback data source';
      break;
    case 'cached':
      baseResponse.degradedReason = 'Serving cached data';
      baseResponse.source = `${result.source} (cached)`;
      break;
    case 'error':
      baseResponse.degradedReason = 'Error occurred, using fallback data';
      baseResponse.isStale = true;
      break;
    case 'none':
    default:
      // No degradation
      break;
  }

  return baseResponse;
}

// ============================================================================
// DEGRADATION CHAIN UTILITIES
// ============================================================================

/**
 * Execute providers in order: primary -> fallback -> cached -> error
 */
export async function withDegradationChain<T>(
  providers: Array<{
    name: string;
    provider: () => Promise<ProviderResult<T>>;
    isEnabled?: boolean;
  }>,
  options: {
    useCache?: boolean;
    cacheKey?: string;
    onError?: (error: Error, providerName: string) => void;
  } = {}
): Promise<DegradedResponse<T>> {
  const { useCache = true, cacheKey, onError } = options;

  for (const { name, provider, isEnabled = true } of providers) {
    if (!isEnabled) continue;

    try {
      const result = await provider();
      return normalizeProviderResult(result, 'none');
    } catch (error) {
      const err = error as Error;
      onError?.(err, name);

      // Continue to next provider in chain
      continue;
    }
  }

  // If we get here, all providers failed
  throw new Error('All providers in degradation chain failed');
}

/**
 * Get degradation level description
 */
export function getDegradationDescription(level: DegradationLevel): string {
  switch (level) {
    case 'none':
      return 'Data is fresh and from primary source';
    case 'stale':
      return 'Data is stale but still usable';
    case 'fallback':
      return 'Using alternative data source';
    case 'cached':
      return 'Serving cached data';
    case 'error':
      return 'Error occurred, limited functionality available';
    default:
      return 'Unknown degradation level';
  }
}

/**
 * Check if response is degraded
 */
export function isDegraded(response: DegradedResponse): boolean {
  return response.isStale || !!response.degradedReason;
}

/**
 * Get degradation severity (0 = none, 1 = minor, 2 = major, 3 = critical)
 */
export function getDegradationSeverity(response: DegradedResponse): number {
  if (!isDegraded(response)) return 0;

  if (response.degradedReason?.includes('stale') || response.degradedReason?.includes('cached')) {
    return 1; // Minor - data is available but not fresh
  }

  if (response.degradedReason?.includes('fallback')) {
    return 2; // Major - using alternative source
  }

  if (response.degradedReason?.includes('Error') || response.degradedReason?.includes('failed')) {
    return 3; // Critical - data may be unavailable or incorrect
  }

  return 1; // Default to minor
}