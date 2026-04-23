/**
 * Environment configuration and validation for FinSight module
 */

import { z } from 'zod';

const configSchema = z.object({
  // Anthropic API for LLM reports
  anthropicApiKey: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // Redis for caching (Upstash)
  redisUrl: z.string().url('REDIS_URL must be a valid URL'),

  // Python FastAPI service URL
  pythonServiceUrl: z.string().url('PYTHON_SERVICE_URL must be a valid URL'),

  // Fallback provider flags
  enableOpenAiFallback: z.boolean().default(false),
  enableAmfiFallback: z.boolean().default(true),
  enableRbiFallback: z.boolean().default(true),

  // Supabase for persistence
  supabaseUrl: z.string().url('SUPABASE_URL must be a valid URL'),
  supabaseServiceRoleKey: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Inngest for job queuing
  inngestEventKey: z.string().min(1, 'INNGEST_EVENT_KEY is required'),
});

export type FinSightConfig = z.infer<typeof configSchema>;

let config: FinSightConfig | null = null;

export function getFinSightConfig(): FinSightConfig {
  if (config) return config;

  const env = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    redisUrl: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
    pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
    enableOpenAiFallback: process.env.ENABLE_OPENAI_FALLBACK === 'true',
    enableAmfiFallback: process.env.ENABLE_AMFI_FALLBACK !== 'false', // default true
    enableRbiFallback: process.env.ENABLE_RBI_FALLBACK !== 'false', // default true
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    inngestEventKey: process.env.INNGEST_EVENT_KEY,
  };

  try {
    config = configSchema.parse(env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors?.map(err => `${err.path.join('.')}: ${err.message}`) || ['Unknown validation error'];
      throw new Error(`FinSight configuration validation failed:\n${messages.join('\n')}`);
    }
    throw error;
  }
}

// Export individual config values as getters to avoid initialization errors
export const anthropicApiKey = () => getFinSightConfig().anthropicApiKey;
export const redisUrl = () => getFinSightConfig().redisUrl;
export const pythonServiceUrl = () => getFinSightConfig().pythonServiceUrl;
export const enableOpenAiFallback = () => getFinSightConfig().enableOpenAiFallback;
export const enableAmfiFallback = () => getFinSightConfig().enableAmfiFallback;
export const enableRbiFallback = () => getFinSightConfig().enableRbiFallback;
export const supabaseUrl = () => getFinSightConfig().supabaseUrl;
export const supabaseServiceRoleKey = () => getFinSightConfig().supabaseServiceRoleKey;
export const inngestEventKey = () => getFinSightConfig().inngestEventKey;