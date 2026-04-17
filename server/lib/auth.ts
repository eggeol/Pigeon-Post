import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { AppError } from "./errors.js";
import { config } from "./config.js";
import { clearSessionCookie, readSessionToken } from "./session.js";

const googleClient = new OAuth2Client();

export async function verifyGoogleCredential(credential: string) {
  if (!config.googleClientId) {
    throw new AppError(
      503,
      "Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID first."
    );
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: config.googleClientId
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || !payload.name || !payload.email_verified) {
    throw new AppError(401, "Google could not verify this account.");
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name,
    avatarUrl: payload.picture ?? null
  };
}

export async function optionalAuth(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const token = request.cookies?.[config.sessionCookieName];

  if (!token) {
    next();
    return;
  }

  try {
    request.user = await readSessionToken(token);
  } catch {
    // Ignore stale cookies for anonymous reads.
  }

  next();
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const token = request.cookies?.[config.sessionCookieName];

  if (!token) {
    next(new AppError(401, "Please sign in to open your roost."));
    return;
  }

  try {
    request.user = await readSessionToken(token);
    next();
  } catch {
    clearSessionCookie(response);
    next(new AppError(401, "Your session drifted away. Please sign in again."));
  }
}
