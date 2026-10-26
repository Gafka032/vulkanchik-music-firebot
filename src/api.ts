/**
 * Vulkanchik Music API v1 client (browser/Node fetch). Pure JS — Win/macOS/Linux.
 */

/** Per-request deadline so a hung API call cannot stall a Firebot effect list forever. */
export const REQUEST_TIMEOUT_MS = 10_000;

export type MusicApiConfig = {
  apiBaseUrl: string;
  apiToken: string;
};

export class MusicApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "MusicApiError";
    this.status = status;
    this.code = code;
  }
}

function normalizeBase(raw: string): string {
  const trimmed = (raw || "https://vulkanchik.com").trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api/music/v1")) return trimmed;
  return `${trimmed}/api/music/v1`;
}

function requestAbortSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}

export function createMusicApi(config: MusicApiConfig) {
  const base = normalizeBase(config.apiBaseUrl);
  const token = (config.apiToken || "").trim();

  async function request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!token) {
      throw new MusicApiError(401, "Music API token is not configured in the plugin settings");
    }
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: requestAbortSignal(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (isAbortError(err)) {
        throw new MusicApiError(
          408,
          `Music API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
          "MUSIC_API_TIMEOUT"
        );
      }
      throw err;
    }
    const text = await res.text();
    let json: { error?: string; code?: string; [k: string]: unknown } | null = null;
    try {
      json = text ? (JSON.parse(text) as typeof json) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      throw new MusicApiError(
        res.status,
        (json && typeof json.error === "string" && json.error) || text || res.statusText,
        json && typeof json.code === "string" ? json.code : undefined
      );
    }
    return (json ?? {}) as T;
  }

  return {
    base,
    getState: () => request("GET", "/state"),
    getQueue: () => request("GET", "/queue"),
    postQueue: (query: string) => request("POST", "/queue", { query }),
    postRequest: (body: {
      query: string;
      requesterName: string;
      requesterTwitchId?: string;
    }) => request("POST", "/requests", body),
    reorderQueue: (orderedIds: string[]) =>
      request("PATCH", "/queue/reorder", { orderedIds }),
    deleteQueueItem: (id: string) => request("DELETE", `/queue/${encodeURIComponent(id)}`),
    skip: () => request("POST", "/skip"),
    play: () => request("POST", "/play"),
    pause: () => request("POST", "/pause"),
    /** Pause when currently playing; otherwise resume (play). */
    togglePlayPause: async () => {
      const state = (await request("GET", "/state")) as {
        playback?: { state?: string };
        snapshot?: unknown;
      };
      const playbackState = state.playback?.state;
      if (playbackState === "playing") return request("POST", "/pause");
      return request("POST", "/play");
    },
    volume: (volume: number) => request("POST", "/volume", { volume }),
    seek: (body: { seconds?: number; delta?: number }) => request("POST", "/seek", body),
    leader: (sessionId: string) => request("POST", "/leader", { sessionId }),
    chat: (body: {
      message: string;
      chatterTwitchId: string;
      chatterName?: string;
      chatterLogin?: string;
      badges?: unknown;
      postReply?: boolean;
    }) => request("POST", "/chat", body),
    getSettings: () => request("GET", "/settings"),
    patchSettings: (patch: Record<string, unknown>) => request("PATCH", "/settings", patch),
    getBackup: () => request("GET", "/backup"),
    putBackup: (body: {
      enabled: boolean;
      urls: string[];
      mode?: string;
      sourcePlaylistUrl?: string | null;
    }) => request("PUT", "/backup", body),
    importBackup: (body: { playlistUrl: string; mode?: string }) =>
      request("POST", "/backup/import", body),
    getRoles: () => request("GET", "/roles"),
    putRoles: (body: unknown) => request("PUT", "/roles", body),
    listPointsRewards: () => request("GET", "/points/rewards"),
    listTwitchRewards: () => request("GET", "/points/twitch-rewards"),
    addPointsReward: (body: Record<string, unknown>) =>
      request("POST", "/points/rewards", body),
    patchPointsReward: (id: string, body: Record<string, unknown>) =>
      request("PATCH", `/points/rewards/${encodeURIComponent(id)}`, body),
    deletePointsReward: (id: string) =>
      request("DELETE", `/points/rewards/${encodeURIComponent(id)}`),
  };
}

export type MusicApi = ReturnType<typeof createMusicApi>;

/** Last successful snapshot for replace variables (in-process). */
let lastSnapshot: Record<string, unknown> | null = null;
let lastRolesJson: string | null = null;

export function rememberSnapshot(data: unknown): void {
  if (data && typeof data === "object") {
    lastSnapshot = data as Record<string, unknown>;
  }
}

export function getRememberedSnapshot(): Record<string, unknown> | null {
  return lastSnapshot;
}

export function rememberRoles(data: unknown): void {
  try {
    lastRolesJson = JSON.stringify(data ?? null);
  } catch {
    lastRolesJson = null;
  }
}

export function getRememberedRolesJson(): string | null {
  return lastRolesJson;
}

export function snapshotField(path: string): unknown {
  const snap = lastSnapshot;
  if (!snap) return "";
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = snap;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur ?? "";
}
