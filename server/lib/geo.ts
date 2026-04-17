import { config } from "./config.js";

const earthRadiusKm = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashRouteSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDistanceKm(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number
) {
  const latitudeDelta = toRadians(destinationLatitude - originLatitude);
  const longitudeDelta = toRadians(destinationLongitude - originLongitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(originLatitude)) *
      Math.cos(toRadians(destinationLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function createFlightPlan(input: {
  senderId: string;
  recipientId: string;
  senderLatitude: number;
  senderLongitude: number;
  recipientLatitude: number;
  recipientLongitude: number;
}) {
  const distanceKm = getDistanceKm(
    input.senderLatitude,
    input.senderLongitude,
    input.recipientLatitude,
    input.recipientLongitude
  );

  const routeSeed = hashRouteSeed(
    [
      input.senderId,
      input.recipientId,
      input.senderLatitude.toFixed(3),
      input.senderLongitude.toFixed(3),
      input.recipientLatitude.toFixed(3),
      input.recipientLongitude.toFixed(3),
      Math.round(distanceKm)
    ].join(":")
  );

  const variabilityFactor = 0.85 + (routeSeed % 50) / 100;
  const travelSeconds = Math.round(
    clamp(
      config.pigeonMinSeconds +
        distanceKm * config.pigeonSecondsPerKm * variabilityFactor,
      config.pigeonMinSeconds,
      config.pigeonMaxSeconds
    )
  );

  return {
    distanceKm: Number(distanceKm.toFixed(1)),
    variabilityFactor: Number(variabilityFactor.toFixed(2)),
    flightDurationSeconds: travelSeconds,
    deliveredAt: new Date(Date.now() + travelSeconds * 1000)
  };
}
