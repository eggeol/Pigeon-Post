import type { SelectedLocation } from "./types";

type GeoapifyResult = {
  address_line1?: string;
  address_line2?: string;
  formatted?: string;
  lat?: number;
  lon?: number;
};

type GeoapifyResponse = {
  results?: GeoapifyResult[];
  error?: string;
  message?: string;
};

function trimLanguageTag(language: string | undefined) {
  return language?.split("-")[0] || "en";
}

function buildLocationLabel(result: GeoapifyResult) {
  return (
    result.formatted ??
    [result.address_line1, result.address_line2].filter(Boolean).join(", ") ??
    ""
  );
}

function toSelectedLocation(result: GeoapifyResult): SelectedLocation | null {
  if (typeof result.lat !== "number" || typeof result.lon !== "number") {
    return null;
  }

  const label = buildLocationLabel(result);

  if (!label) {
    return null;
  }

  return {
    label,
    latitude: result.lat,
    longitude: result.lon
  };
}

async function geoapifyRequest(url: URL, fallbackMessage: string) {
  const response = await fetch(url);
  const payload = (await response.json().catch(() => null)) as GeoapifyResponse | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? fallbackMessage);
  }

  return payload;
}

export async function searchLocations(input: {
  apiKey: string;
  query: string;
  language?: string;
}) {
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("apiKey", input.apiKey);
  url.searchParams.set("text", input.query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", trimLanguageTag(input.language));

  const payload = await geoapifyRequest(url, "Could not search for that place.");
  const seen = new Set<string>();

  return (payload?.results ?? [])
    .map(toSelectedLocation)
    .filter((result): result is SelectedLocation => Boolean(result))
    .filter((result) => {
      const key = `${result.label}:${result.latitude}:${result.longitude}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export async function reverseGeocodeLocation(input: {
  apiKey: string;
  latitude: number;
  longitude: number;
  language?: string;
}) {
  const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
  url.searchParams.set("apiKey", input.apiKey);
  url.searchParams.set("lat", String(input.latitude));
  url.searchParams.set("lon", String(input.longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", trimLanguageTag(input.language));

  const payload = await geoapifyRequest(
    url,
    "Could not turn that location into an address."
  );

  return payload?.results?.[0]?.formatted ?? null;
}
