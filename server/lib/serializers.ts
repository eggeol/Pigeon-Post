import type { Message, User } from "@prisma/client";
import type { ApiMessage, ApiUser } from "../types.js";

type UserSummary = Pick<User, "id" | "name" | "email" | "avatarUrl" | "handle">;

export function serializeUser(user: User): ApiUser {
  const hasHomeLocation =
    user.homeLabel !== null &&
    user.homeLatitude !== null &&
    user.homeLongitude !== null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    handle: user.handle,
    homeLocation: hasHomeLocation
      ? {
          label: user.homeLabel!,
          latitude: user.homeLatitude!,
          longitude: user.homeLongitude!
        }
      : null,
    profileReady: Boolean(hasHomeLocation)
  };
}

export function serializeUserSummary(user: UserSummary) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    handle: user.handle
  };
}

export function serializeMessage(
  message: Message & { sender: UserSummary; recipient: UserSummary }
): ApiMessage {
  const now = Date.now();
  const delivered = new Date(message.deliveredAt).getTime() <= now;

  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    deliveredAt: message.deliveredAt.toISOString(),
    distanceKm: message.distanceKm,
    flightDurationSeconds: message.flightDurationSeconds,
    variabilityFactor: message.variabilityFactor,
    sender: serializeUserSummary(message.sender),
    recipient: serializeUserSummary(message.recipient),
    route: {
      from: {
        label: message.senderLabel,
        latitude: message.senderLatitude,
        longitude: message.senderLongitude
      },
      to: {
        label: message.recipientLabel,
        latitude: message.recipientLatitude,
        longitude: message.recipientLongitude
      }
    },
    status: delivered ? "delivered" : "in_flight"
  };
}
