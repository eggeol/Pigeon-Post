const displayDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function formatDistance(value: number) {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: value < 100 ? 1 : 0
  })} km`;
}

export function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatDateTime(isoString: string) {
  return displayDate.format(new Date(isoString));
}

export function formatCountdown(isoString: string, now: number) {
  const seconds = Math.ceil((new Date(isoString).getTime() - now) / 1000);

  if (seconds <= 0) {
    return "Arrived";
  }

  if (seconds < 90) {
    return `Arrives in ${seconds}s`;
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainderSeconds = seconds % 60;

    return remainderSeconds === 0
      ? `Arrives in ${minutes}m`
      : `Arrives in ${minutes}m ${remainderSeconds}s`;
  }

  return `Arrives in ${formatDuration(seconds)}`;
}

export function formatHandle(handle: string | null) {
  return handle ? `@${handle}` : "Unclaimed tag";
}

export function buildCoordinateLabel(latitude: number, longitude: number) {
  return `Pinned by GPS · ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
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

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateFlight(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  now: number
) {
  const distanceKm = getDistanceKm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude
  );
  const seconds = Math.max(45, Math.min(7200, Math.round(45 + distanceKm * 0.45)));

  return {
    distanceKm,
    flightDurationSeconds: seconds,
    deliveredAt: new Date(now + seconds * 1000).toISOString()
  };
}
