import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (one level up from orchestrator/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // also load orchestrator-level .env if present

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  mongoUri: requireEnv('MONGODB_URI'),
  redisUrl: requireEnv('REDIS_URL'),

  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiry: process.env.JWT_EXPIRY ?? '24h',

  nluServiceUrl: requireEnv('NLU_SERVICE_URL'),
  ragServiceUrl: requireEnv('RAG_SERVICE_URL'),

  frontendUrl: requireEnv('FRONTEND_URL'),

  // Google OAuth
  googleClientId: requireEnv('GOOGLE_CLIENT_ID', ''),
  googleClientSecret: requireEnv('GOOGLE_CLIENT_SECRET', ''),
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/google/callback',

  // Gemini LLM
  geminiApiKey: process.env.GOOGLE_API_KEY ?? process.env.LLM_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',

  // SMTP fallback
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',

  logLevel: process.env.LOG_LEVEL ?? 'info',
};

export type AppConfig = typeof config;
