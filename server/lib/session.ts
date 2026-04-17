import type { Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config.js";
import type { SessionPayload } from "../types.js";

const sessionKey = new TextEncoder().encode(config.jwtSecret);
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds}s`)
    .sign(sessionKey);
}

export async function readSessionToken(token: string) {
  const { payload } = await jwtVerify(token, sessionKey);
  return {
    userId: String(payload.userId),
    email: String(payload.email)
  } satisfies SessionPayload;
}

export function setSessionCookie(response: Response, token: string) {
  response.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: sessionMaxAgeSeconds * 1000,
    path: "/"
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/"
  });
}
