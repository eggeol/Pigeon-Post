export type SessionPayload = {
  userId: string;
  email: string;
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  handle: string | null;
  homeLocation:
    | {
        label: string;
        latitude: number;
        longitude: number;
      }
    | null;
  profileReady: boolean;
};

export type ApiMessage = {
  id: string;
  body: string;
  createdAt: string;
  deliveredAt: string;
  distanceKm: number;
  flightDurationSeconds: number;
  variabilityFactor: number;
  sender: Pick<ApiUser, "id" | "name" | "email" | "avatarUrl" | "handle">;
  recipient: Pick<ApiUser, "id" | "name" | "email" | "avatarUrl" | "handle">;
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
