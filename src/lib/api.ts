import type { AppMessage, AppUser, MailboxPayload, PublicConfig } from "./types";

type ApiError = {
  error?: string;
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const maybeJson = (await response
      .json()
      .catch(() => null)) as ApiError | null;
    throw new Error(maybeJson?.error ?? "Something went wrong.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getConfig() {
    return request<PublicConfig>("/api/config");
  },
  getCurrentUser() {
    return request<{ user: AppUser | null }>("/api/auth/me");
  },
  signInWithGoogle(credential: string) {
    return request<{ user: AppUser }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential })
    });
  },
  logout() {
    return request<void>("/api/auth/logout", {
      method: "POST"
    });
  },
  updateProfile(input: {
    homeLabel: string;
    homeLatitude: number;
    homeLongitude: number;
  }) {
    return request<{ user: AppUser }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(input)
    });
  },
  searchUsers(query: string) {
    const params = new URLSearchParams({ q: query });
    return request<{ users: AppUser[] }>(`/api/users/search?${params.toString()}`);
  },
  getMailbox() {
    return request<MailboxPayload>("/api/messages");
  },
  sendMessage(input: {
    recipientId: string;
    body: string;
    dispatchMode: "home" | "current";
    senderLabel?: string;
    senderLatitude?: number;
    senderLongitude?: number;
  }) {
    return request<{ message: AppMessage }>("/api/messages", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
};
