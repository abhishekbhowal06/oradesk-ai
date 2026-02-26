/**
 * Centralized Configuration with Fail-Loud Validation
 *
 * This module validates all required environment variables on startup.
 * If any critical variable is missing, the service will fail to start
 * with a clear error message.
 */

import { logger } from './logging/structured-logger';

interface Config {
  // Supabase
  supabaseUrl: string;
  supabaseKey: string; // service_role key (admin)
  supabaseAnonKey: string; // anon key (RLS-respecting)

  // Twilio
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;

  // LLMs
  primaryLlmKey: string;
  fallbackLlmKey: string | null;

  // ElevenLabs
  elevenLabsKey: string | null;

  // Vapi
  vapiKey: string | null;

  // Service
  serviceUrl: string;
  port: number;

  // Flags
  isTestMode: boolean;
  isMockMode: boolean;
}

function getEnv(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (!value && required) {
    throw new Error(`FATAL: Missing required environment variable: ${key}`);
  }
  return value || '';
}

function validateConfig(): Config {
  const errors: string[] = [];

  // Collect all missing required vars
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'PRIMARY_LLM_API_KEY',
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(varName);
    }
  }

  if (errors.length > 0) {
    logger.error(`Missing required environment variables: ${errors.join(', ')}`);
    throw new Error(`FATAL: Missing required environment variables: ${errors.join(', ')}`);
  }

  // Detect test mode
  const twilioSid = process.env.TWILIO_ACCOUNT_SID!;
  const isTestMode = twilioSid.startsWith('AC') && twilioSid.includes('test');

  // Detect mock mode (placeholder values)
  const supabaseUrl = process.env.SUPABASE_URL!;
  const isMockMode = supabaseUrl.includes('test.supabase.co') || supabaseUrl.includes('localhost');

  if (isTestMode) {
    logger.warn('Running in TEST MODE - Twilio calls will be simulated');
  }

  if (isMockMode) {
    logger.warn('Running in MOCK MODE - Database operations may fail');
  }

  return {
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID!,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN!,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER!,
    primaryLlmKey: process.env.PRIMARY_LLM_API_KEY!,
    fallbackLlmKey: process.env.FALLBACK_LLM_API_KEY || null,
    elevenLabsKey: process.env.ELEVENLABS_API_KEY || null,
    vapiKey: process.env.VAPI_API_KEY || null,
    serviceUrl: process.env.SERVICE_URL || 'http://localhost:8080',
    port: parseInt(process.env.PORT || '8080', 10),
    isTestMode,
    isMockMode,
  };
}

// Validate on import
export const config = validateConfig();

logger.info('Configuration validated successfully', {
  supabaseUrl: config.supabaseUrl.substring(0, 30) + '...',
  twilioPhone: config.twilioPhoneNumber,
  isTestMode: config.isTestMode,
  isMockMode: config.isMockMode,
  hasElevenLabs: !!config.elevenLabsKey,
  hasVapi: !!config.vapiKey,
  hasFallbackLlm: !!config.fallbackLlmKey,
});
