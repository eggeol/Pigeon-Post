export type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  handle: string | null;
  homeLocation:
    | SelectedLocation
    | null;
  profileReady: boolean;
};

export type AppMessage = {
  id: string;
  body: string;
  createdAt: string;
  deliveredAt: string;
  distanceKm: number;
  flightDurationSeconds: number;
  variabilityFactor: number;
  sender: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    handle: string | null;
  };
  recipient: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    handle: string | null;
  };
  route: {
    from: {
      label: string;
      latitude: number;
      longitude: number;
    };
    to: {
      label: string;
      latitude: number;
      longitude: number;
    };
  };
  status: "in_flight" | "delivered";
};

export type MailboxPayload = {
  inbox: AppMessage[];
  outbox: AppMessage[];
  stats: {
    deliveredInboxCount: number;
    totalSentCount: number;
    airborneToYouCount: number;
  };
};

export type PublicConfig = {
  googleClientId: string;
  geoapifyApiKey: string;
};
