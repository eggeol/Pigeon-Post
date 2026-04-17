import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const devJwtSecret = crypto
  .createHash("sha256")
  .update("pigeon-post-dev-secret")
  .digest("hex");

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

if (!process.env.JWT_SECRET && isProduction) {
  throw new Error("JWT_SECRET is required in production.");
}

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: process.env.DATABASE_URL,
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  geoapifyApiKey: process.env.GEOAPIFY_API_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET ?? devJwtSecret,
  appUrl: process.env.APP_URL ?? "",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "pigeon_post_session",
  pigeonMinSeconds: Number(process.env.PIGEON_MIN_SECONDS ?? 45),
  pigeonSecondsPerKm: Number(process.env.PIGEON_SECONDS_PER_KM ?? 0.45),
  pigeonMaxSeconds: Number(process.env.PIGEON_MAX_SECONDS ?? 7200)
};
