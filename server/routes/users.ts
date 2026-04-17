import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { serializeUser } from "../lib/serializers.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/users/search", async (request, response) => {
  const query = String(request.query.q ?? "").trim();
  const maxResults = query ? 6 : 2;

  const users = await prisma.user.findMany({
    where: {
      id: { not: request.user!.userId },
      homeLabel: { not: null },
      homeLatitude: { not: null },
      homeLongitude: { not: null },
      OR: query
        ? [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { handle: { contains: query.toLowerCase(), mode: "insensitive" } }
          ]
        : undefined
    },
    orderBy: [{ updatedAt: "desc" }],
    take: maxResults
  });

  response.json({
    users: users.map(serializeUser)
  });
});
