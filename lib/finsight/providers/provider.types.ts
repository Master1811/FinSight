/**
 * Provider adapter contracts for FinSight data sources
 */

import { DegradedResponse } from './degrade';

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface ProviderOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
}

export interface ProviderResult<T = any> {
  data: T;
  asOf: string; // ISO timestamp
  source: string;
  isStale?: boolean;
  metadata?: Record<string, any>;
}

// ============================================================================
// EQUITY PROVIDER
// ============================================================================

export interface EquityData {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  pe?: number;
  pb?: number;
  dividendYield?: number;
}

export interface HistoricalPrice {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  adjustedClose?: number;
}

export interface EquityProvider {
  /**
   * Get live price data for a symbol
   */
  getLivePrice(symbol: string, options?: ProviderOptions): Promise<ProviderResult<EquityData>>;

  /**
   * Get historical price data for a symbol
   */
  getHistoricalPrices(
    symbol: string,
    startDate: string,
    endDate: string,
    options?: ProviderOptions
  ): Promise<ProviderResult<HistoricalPrice[]>>;

  /**
   * Get basic info for a symbol
   */
  getSymbolInfo(symbol: string, options?: ProviderOptions): Promise<ProviderResult<EquityData>>;
}

// ============================================================================
// MUTUAL FUND PROVIDER
// ============================================================================

export interface MutualFundData {
  schemeCode: string;
  schemeName: string;
  nav: number;
  navDate: string; // YYYY-MM-DD
  fundHouse: string;
  schemeType: string;
  schemeCategory: string;
  aum?: number; // Assets Under Management
  expenseRatio?: number;
  exitLoad?: string;
}

export interface MutualFundProvider {
  /**
   * Search for mutual fund schemes by name or code
   */
  searchSchemes(query: string, options?: ProviderOptions): Promise<ProviderResult<MutualFundData[]>>;

  /**
   * Get NAV history for a scheme
   */
  getNavHistory(
    schemeCode: string,
    startDate: string,
    endDate: string,
    options?: ProviderOptions
  ): Promise<ProviderResult<{ schemeCode: string; navs: Array<{ date: string; nav: number }> }>>;

  /**
   * Get latest NAV for a scheme
   */
  getLatestNav(schemeCode: string, options?: ProviderOptions): Promise<ProviderResult<MutualFundData>>;
}

// ============================================================================
// MACRO PROVIDER
// ============================================================================

export interface MacroData {
  inflation?: {
    value: number;
    unit: string;
    period: string;
    country: string;
  };
  interestRates?: {
    repoRate?: number;
    reverseRepoRate?: number;
    mslfRate?: number;
    bankRate?: number;
    lastUpdated: string;
  };
  gdp?: {
    value: number;
    unit: string;
    period: string;
    growth?: number;
  };
  unemployment?: {
    value: number;
    unit: string;
    period: string;
  };
  currency?: {
    usdInr?: number;
    eurInr?: number;
    gbpInr?: number;
    lastUpdated: string;
  };
}

export interface MacroProvider {
  /**
   * Get comprehensive macro economic data
   */
  getMacroData(options?: ProviderOptions): Promise<ProviderResult<MacroData>>;
}

// ============================================================================
// LLM PROVIDER
// ============================================================================

export interface LlmPrompt {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LlmResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

export interface LlmProvider {
  /**
   * Generate text using LLM
   */
  generateText(prompt: LlmPrompt, options?: ProviderOptions): Promise<ProviderResult<LlmResponse>>;
}

// ============================================================================
// PROVIDER REGISTRY TYPES
// ============================================================================

export type ProviderType = 'equity' | 'mutual-fund' | 'macro' | 'llm';

export interface ProviderConfig {
  primary: string; // provider name
  fallback?: string; // fallback provider name
  enabled: boolean;
}

export interface ProviderRegistryConfig {
  equity: ProviderConfig;
  'mutual-fund': ProviderConfig;
  macro: ProviderConfig;
  llm: ProviderConfig;
}