import type { DashboardResponse, SessionPayload } from "./types";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const text = await response.text();
  let body: any = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const message = body?.error || body?.message || `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export const jarvisApi = {
  getDashboard: () => requestJson<DashboardResponse>("/api/dashboard"),
  getSettings: () => requestJson("/api/settings"),
  getCalendarStatus: () => requestJson("/api/calendar/status"),
  getChatSession: (sessionId: string) =>
    requestJson<SessionPayload>(`/api/chats/${encodeURIComponent(sessionId)}`),
  sendCommand: (text: string) =>
    requestJson("/api/command", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  setMute: (muted: boolean) =>
    requestJson("/api/mute", {
      method: "POST",
      body: JSON.stringify({ muted }),
    }),
  saveSettings: (settings: Record<string, unknown>) =>
    requestJson("/api/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  connectCalendar: (settings: Record<string, unknown>) =>
    requestJson("/api/calendar/connect", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  startNewSession: () =>
    requestJson("/api/session/new", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  endSession: (summary?: string) =>
    requestJson("/api/session/end", {
      method: "POST",
      body: JSON.stringify({ summary }),
    }),
};

