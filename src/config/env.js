const DEFAULTS = {
  NODE_ENV: "development",
  HOST: "127.0.0.1",
  PORT: "3000",
  MAX_JSON_BYTES: "65536",
  APP_BASE_URL: "http://127.0.0.1:3000",
  ALLOW_MEMORY_MODE: "false"
};

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "REDIS_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "SESSION_SECRET"
];

export function loadEnv(source = process.env) {
  const env = { ...DEFAULTS, ...source };
  const config = {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    host: env.HOST,
    port: toInt(env.PORT, 3000),
    maxJsonBytes: toInt(env.MAX_JSON_BYTES, 65536),
    appBaseUrl: env.APP_BASE_URL,
    allowMemoryMode: env.ALLOW_MEMORY_MODE === "true",
    databaseUrl: env.DATABASE_URL || "",
    redisUrl: env.REDIS_URL || "",
    sessionSecret: env.SESSION_SECRET || "",
    storage: {
      endpoint: env.S3_ENDPOINT || "",
      bucket: env.S3_BUCKET || "",
      accessKeyId: env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
      publicBaseUrl: env.S3_PUBLIC_BASE_URL || ""
    },
    providers: {
      meshy: env.MESHY_API_KEY || "",
      tripo: env.TRIPO_API_KEY || "",
      elevenlabs: env.ELEVENLABS_API_KEY || "",
      cartesia: env.CARTESIA_API_KEY || "",
      runway: env.RUNWAY_API_KEY || "",
      luma: env.LUMA_API_KEY || "",
      tiktokClientId: env.TIKTOK_CLIENT_ID || "",
      tiktokClientSecret: env.TIKTOK_CLIENT_SECRET || ""
    }
  };

  validateEnv(config);
  return config;
}

function validateEnv(config) {
  if (!config.isProduction) return;
  if (config.allowMemoryMode) return;
  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  if (config.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
}

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
