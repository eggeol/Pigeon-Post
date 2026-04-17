import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { createSessionToken, clearSessionCookie, setSessionCookie } from "../lib/session.js";
import { serializeUser } from "../lib/serializers.js";
import { optionalAuth, verifyGoogleCredential } from "../lib/auth.js";
import { config } from "../lib/config.js";

export const authRouter = Router();

authRouter.get("/config", (_request, response) => {
  response.json({
    googleClientId: config.googleClientId,
    geoapifyApiKey: config.geoapifyApiKey
  });
});

authRouter.get("/auth/me", optionalAuth, async (request, response) => {
  if (!request.user) {
    response.json({ user: null });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: request.user.userId }
  });

  if (!user) {
    clearSessionCookie(response);
    response.json({ user: null });
    return;
  }

  response.json({ user: serializeUser(user) });
});

authRouter.post("/auth/google", async (request, response) => {
  const credential = String(request.body?.credential ?? "");

  if (!credential) {
    throw new AppError(400, "Google sign-in did not return a credential.");
  }

  const googleProfile = await verifyGoogleCredential(credential);

  const user = await prisma.user.upsert({
    where: { googleSub: googleProfile.googleSub },
    update: {
      email: googleProfile.email,
      name: googleProfile.name,
      avatarUrl: googleProfile.avatarUrl
    },
    create: {
      googleSub: googleProfile.googleSub,
      email: googleProfile.email,
      name: googleProfile.name,
      avatarUrl: googleProfile.avatarUrl
    }
  });

  const token = await createSessionToken({
    userId: user.id,
    email: user.email
  });

  setSessionCookie(response, token);
  response.json({ user: serializeUser(user) });
});

authRouter.post("/auth/logout", (_request, response) => {
  clearSessionCookie(response);
  response.status(204).send();
});
