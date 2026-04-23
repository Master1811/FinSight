/**
 * Provider registry for resolving primary/fallback providers by environment
 */

import {
  EquityProvider,
  MutualFundProvider,
  MacroProvider,
  LlmProvider,
  ProviderType,
  ProviderRegistryConfig,
} from './provider.types';
import {
  enableAmfiFallback,
  enableOpenAiFallback,
  enableRbiFallback,
} from '../config';

// ============================================================================
// PROVIDER REGISTRY CONFIGURATION
// ============================================================================

const PROVIDER_REGISTRY_CONFIG: ProviderRegistryConfig = {
  equity: {
    primary: 'yfinance', // Will be implemented in Python service
    fallback: 'yfinance', // Single provider for now
    enabled: true,
  },
  'mutual-fund': {
    primary: 'mfapi',
    fallback: 'amfi',
    enabled: enableAmfiFallback(),
  },
  macro: {
    primary: 'worldbank',
    fallback: 'rbi',
    enabled: enableRbiFallback(),
  },
  llm: {
    primary: 'anthropic',
    fallback: 'openai',
    enabled: enableOpenAiFallback(),
  },
};

// ============================================================================
// PROVIDER REGISTRY CLASS
// ============================================================================

export class ProviderRegistry {
  private providers = new Map<string, any>();
  private config: ProviderRegistryConfig;

  constructor(config: ProviderRegistryConfig = PROVIDER_REGISTRY_CONFIG) {
    this.config = config;
  }

  /**
   * Register a provider implementation
   */
  register<T>(name: string, provider: T): void {
    this.providers.set(name, provider);
  }

  /**
   * Get provider for a specific type, with fallback logic
   */
  getProvider<T>(type: ProviderType): T {
    const config = this.config[type];

    if (!config.enabled) {
      throw new Error(`Provider type '${type}' is disabled`);
    }

    // Try primary provider first
    const primaryProvider = this.providers.get(config.primary);
    if (primaryProvider) {
      return primaryProvider;
    }

    // Try fallback provider
    if (config.fallback) {
      const fallbackProvider = this.providers.get(config.fallback);
      if (fallbackProvider) {
        return fallbackProvider;
      }
    }

    throw new Error(`No provider available for type '${type}'. Primary: ${config.primary}, Fallback: ${config.fallback}`);
  }

  /**
   * Get all available providers for a type (for health checks)
   */
  getAvailableProviders(type: ProviderType): string[] {
    const config = this.config[type];
    const available: string[] = [];

    if (this.providers.has(config.primary)) {
      available.push(config.primary);
    }

    if (config.fallback && this.providers.has(config.fallback)) {
      available.push(config.fallback);
    }

    return available;
  }

  /**
   * Check if a provider type is enabled
   */
  isEnabled(type: ProviderType): boolean {
    return this.config[type].enabled;
  }

  /**
   * Get registry configuration
   */
  getConfig(): ProviderRegistryConfig {
    return { ...this.config };
  }

  /**
   * Get all registered provider names
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// ============================================================================
// SINGLETON REGISTRY INSTANCE
// ============================================================================

const registry = new ProviderRegistry();

// ============================================================================
// TYPE-SAFE PROVIDER GETTERS
// ============================================================================

export function getEquityProvider(): EquityProvider {
  return registry.getProvider<EquityProvider>('equity');
}

export function getMutualFundProvider(): MutualFundProvider {
  return registry.getProvider<MutualFundProvider>('mutual-fund');
}

export function getMacroProvider(): MacroProvider {
  return registry.getProvider<MacroProvider>('macro');
}

export function getLlmProvider(): LlmProvider {
  return registry.getProvider<LlmProvider>('llm');
}

// ============================================================================
// PROVIDER REGISTRATION HELPERS
// ============================================================================

export function registerEquityProvider(name: string, provider: EquityProvider): void {
  registry.register(name, provider);
}

export function registerMutualFundProvider(name: string, provider: MutualFundProvider): void {
  registry.register(name, provider);
}

export function registerMacroProvider(name: string, provider: MacroProvider): void {
  registry.register(name, provider);
}

export function registerLlmProvider(name: string, provider: LlmProvider): void {
  registry.register(name, provider);
}

// ============================================================================
// HEALTH CHECK HELPERS
// ============================================================================

export function getProviderHealth(): Record<string, { enabled: boolean; available: string[] }> {
  const types: ProviderType[] = ['equity', 'mutual-fund', 'macro', 'llm'];

  return types.reduce((acc, type) => {
    acc[type] = {
      enabled: registry.isEnabled(type),
      available: registry.getAvailableProviders(type),
    };
    return acc;
  }, {} as Record<string, { enabled: boolean; available: string[] }>);
}

export function getRegistry(): ProviderRegistry {
  return registry;
}