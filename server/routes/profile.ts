import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { serializeUser } from "../lib/serializers.js";
import { requireAuth } from "../lib/auth.js";

const updateProfileSchema = z.object({
  homeLabel: z.string().trim().min(2).max(80),
  homeLatitude: z.number().min(-90).max(90),
  homeLongitude: z.number().min(-180).max(180)
});

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.put("/profile", async (request, response) => {
  const payload = updateProfileSchema.parse({
    homeLabel: request.body?.homeLabel,
    homeLatitude: Number(request.body?.homeLatitude),
    homeLongitude: Number(request.body?.homeLongitude)
  });

  const user = await prisma.user.update({
    where: { id: request.user!.userId },
    data: {
      homeLabel: payload.homeLabel,
      homeLatitude: payload.homeLatitude,
      homeLongitude: payload.homeLongitude
    }
  });

  response.json({ user: serializeUser(user) });
});
