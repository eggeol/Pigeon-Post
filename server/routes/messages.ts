import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { createFlightPlan } from "../lib/geo.js";
import { requireAuth } from "../lib/auth.js";
import { serializeMessage } from "../lib/serializers.js";

const sendMessageSchema = z.object({
  recipientId: z.string().cuid(),
  body: z.string().trim().min(1).max(500),
  dispatchMode: z.enum(["home", "current"]),
  senderLabel: z.string().trim().min(2).max(80).optional(),
  senderLatitude: z.number().min(-90).max(90).optional(),
  senderLongitude: z.number().min(-180).max(180).optional()
});

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get("/messages", async (request, response) => {
  const [inbox, outbox, airborneToYouCount] = await Promise.all([
    prisma.message.findMany({
      where: {
        recipientId: request.user!.userId,
        deliveredAt: { lte: new Date() }
      },
      include: {
        sender: true,
        recipient: true
      },
      orderBy: { deliveredAt: "desc" },
      take: 20
    }),
    prisma.message.findMany({
      where: {
        senderId: request.user!.userId
      },
      include: {
        sender: true,
        recipient: true
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.message.count({
      where: {
        recipientId: request.user!.userId,
        deliveredAt: { gt: new Date() }
      }
    })
  ]);

  response.json({
    inbox: inbox.map(serializeMessage),
    outbox: outbox.map(serializeMessage),
    stats: {
      deliveredInboxCount: inbox.length,
      totalSentCount: outbox.length,
      airborneToYouCount
    }
  });
});

messagesRouter.post("/messages", async (request, response) => {
  const payload = sendMessageSchema.parse({
    recipientId: request.body?.recipientId,
    body: request.body?.body,
    dispatchMode: request.body?.dispatchMode,
    senderLabel: request.body?.senderLabel,
    senderLatitude:
      request.body?.senderLatitude === undefined
        ? undefined
        : Number(request.body.senderLatitude),
    senderLongitude:
      request.body?.senderLongitude === undefined
        ? undefined
        : Number(request.body.senderLongitude)
  });

  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({
      where: { id: request.user!.userId }
    }),
    prisma.user.findUnique({
      where: { id: payload.recipientId }
    })
  ]);

  if (!sender) {
    throw new AppError(401, "Please sign in again before sending mail.");
  }

  if (!recipient) {
    throw new AppError(404, "That recipient could not be found.");
  }

  if (sender.id === recipient.id) {
    throw new AppError(400, "Pigeons refuse to deliver letters to their own perch.");
  }

  if (
    recipient.homeLabel === null ||
    recipient.homeLatitude === null ||
    recipient.homeLongitude === null
  ) {
    throw new AppError(400, "This recipient has not finished setting their roost.");
  }

  const homeDispatchReady =
    sender.homeLabel !== null &&
    sender.homeLatitude !== null &&
    sender.homeLongitude !== null;

  if (payload.dispatchMode === "home" && !homeDispatchReady) {
    throw new AppError(400, "Set your home roost before dispatching from it.");
  }

  if (
    payload.dispatchMode === "current" &&
    (!payload.senderLabel ||
      payload.senderLatitude === undefined ||
      payload.senderLongitude === undefined)
  ) {
    throw new AppError(400, "Share your current perch so the pigeon knows where to leave from.");
  }

  const senderLocation =
    payload.dispatchMode === "current"
      ? {
          label: payload.senderLabel!,
          latitude: payload.senderLatitude!,
          longitude: payload.senderLongitude!
        }
      : {
          label: sender.homeLabel!,
          latitude: sender.homeLatitude!,
          longitude: sender.homeLongitude!
        };

  const flightPlan = createFlightPlan({
    senderId: sender.id,
    recipientId: recipient.id,
    senderLatitude: senderLocation.latitude,
    senderLongitude: senderLocation.longitude,
    recipientLatitude: recipient.homeLatitude,
    recipientLongitude: recipient.homeLongitude
  });

  const message = await prisma.message.create({
    data: {
      senderId: sender.id,
      recipientId: recipient.id,
      body: payload.body,
      senderLabel: senderLocation.label,
      senderLatitude: senderLocation.latitude,
      senderLongitude: senderLocation.longitude,
      recipientLabel: recipient.homeLabel,
      recipientLatitude: recipient.homeLatitude,
      recipientLongitude: recipient.homeLongitude,
      distanceKm: flightPlan.distanceKm,
      variabilityFactor: flightPlan.variabilityFactor,
      flightDurationSeconds: flightPlan.flightDurationSeconds,
      deliveredAt: flightPlan.deliveredAt
    },
    include: {
      sender: true,
      recipient: true
    }
  });

  response.status(201).json({
    message: serializeMessage(message)
  });
});
