import type { EffectType } from "@crowbartools/firebot-types";
import { rememberRoles, rememberSnapshot } from "../api";
import {
  checkbox,
  field,
  makeEffect,
  parseIds,
  parseJsonField,
  parseUrls,
  str,
} from "../effectFactory";
import { readParams, sendChatLines } from "../config";

function metaUser(trigger: { metadata?: Record<string, unknown> }) {
  const m = trigger.metadata ?? {};
  const userId = str(m.userId ?? m.userid ?? m.user_id);
  const username = str(m.username ?? m.userName);
  const display =
    str(m.userDisplayName ?? m.user_display_name ?? m.displayName) || username;
  return { userId, username, display };
}

export function buildAllEffects(): EffectType[] {
  const effects: EffectType[] = [];

  // ----- Chat -----
  effects.push(
    makeEffect({
      id: "chat-command",
      name: "Chat command",
      description: "POST /chat — run streamer aliases (!замов, !скіп, …)",
      icon: "fad fa-comment-dots",
      template:
        field("message", "Chat message", { placeholder: "!замов Artist — Title" }) +
        field("chatterTwitchId", "Chatter Twitch user id") +
        field("chatterName", "Chatter display name (optional)") +
        field("chatterLogin", "Chatter login (optional)") +
        field("badgesJson", "Badges JSON (optional)", {
          textarea: true,
          placeholder: '{"mod":true}',
        }) +
        checkbox("postReply", "Also let Vulkanchik bot post replies (postReply)"),
      validate: (e) => {
        // self-contained for Firebot UI eval (no module helpers)
        const errs = [];
        if (!String(e.message ?? "").trim()) errs.push("Message is required");
        if (!String(e.chatterTwitchId ?? "").trim()) errs.push("Chatter Twitch user id is required");
        return errs;
      },
      run: async ({ effect, api }) => {
        const badges = parseJsonField(effect.badgesJson, "Badges");
        const body: Record<string, unknown> = {
          message: str(effect.message),
          chatterTwitchId: str(effect.chatterTwitchId),
          postReply: Boolean(effect.postReply),
        };
        if (str(effect.chatterName)) body.chatterName = str(effect.chatterName);
        if (str(effect.chatterLogin)) body.chatterLogin = str(effect.chatterLogin);
        if (badges !== undefined) body.badges = badges;
        const res = (await api.chat(body as never)) as {
          replies?: string[];
          snapshot?: unknown;
          handled?: boolean;
        };
        if (res.snapshot) rememberSnapshot(res.snapshot);
        return {
          outputs: {
            apiResponse: JSON.stringify(res),
            handled: res.handled,
            replies: (res.replies ?? []).join("\n"),
            snapshot: res.snapshot,
          },
          chatLines: !effect.postReply ? res.replies ?? [] : [],
        };
      },
      outputs: [
        { label: "Handled", description: "Whether a command ran", defaultName: "handled" },
        { label: "Replies", description: "Chat reply lines", defaultName: "replies" },
        { label: "Response JSON", description: "Raw API JSON", defaultName: "apiResponse" },
      ],
    })
  );

  // ----- Queue -----
  effects.push(
    makeEffect({
      id: "enqueue-streamer",
      name: "Enqueue (streamer)",
      description: "POST /queue — add track as streamer",
      template: field("query", "Query / URL", { placeholder: "Artist — Title or YouTube URL" }),
      validate: (e) => (!String(e.query ?? "").trim() ? ["Query is required"] : []),
      run: async ({ effect, api }) => {
        const res = await api.postQueue(str(effect.query));
        rememberSnapshot((res as { snapshot?: unknown }).snapshot);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: (res as { snapshot?: unknown }).snapshot } };
      },
    }),
    makeEffect({
      id: "song-request",
      name: "Song request (viewer)",
      description: "POST /requests — viewer limits like !замов",
      template:
        field("query", "Query / URL") +
        field("requesterName", "Requester name") +
        field("requesterTwitchId", "Requester Twitch id (optional)"),
      validate: (e) => {
        const errs = [];
        if (!String(e.query ?? "").trim()) errs.push("Query is required");
        if (!String(e.requesterName ?? "").trim()) errs.push("Requester name is required");
        return errs;
      },
      run: async ({ effect, api }) => {
        const body: { query: string; requesterName: string; requesterTwitchId?: string } = {
          query: str(effect.query),
          requesterName: str(effect.requesterName),
        };
        if (str(effect.requesterTwitchId)) body.requesterTwitchId = str(effect.requesterTwitchId);
        const res = await api.postRequest(body);
        rememberSnapshot((res as { snapshot?: unknown }).snapshot);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: (res as { snapshot?: unknown }).snapshot } };
      },
    }),
    makeEffect({
      id: "remove-queue-item",
      name: "Remove queue item",
      description: "DELETE /queue/:id",
      template: field("itemId", "Queue item id"),
      validate: (e) => (!String(e.itemId ?? "").trim() ? ["Item id is required"] : []),
      run: async ({ effect, api }) => {
        const res = await api.deleteQueueItem(str(effect.itemId));
        rememberSnapshot(res);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: res } };
      },
    }),
    makeEffect({
      id: "reorder-queue",
      name: "Reorder queue",
      description: "PATCH /queue/reorder",
      template: field("orderedIds", "Ordered ids (comma or space separated)", { textarea: true }),
      validate: (e) => {
        const ids = String(e.orderedIds ?? "")
          .trim()
          .split(/[\s,]+/)
          .map((x) => x.trim())
          .filter(Boolean);
        return ids.length === 0 ? ["At least one id"] : [];
      },
      run: async ({ effect, api }) => {
        const res = await api.reorderQueue(parseIds(effect.orderedIds));
        rememberSnapshot(res);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: res } };
      },
    }),
    makeEffect({
      id: "get-state",
      name: "Get state",
      description: "GET /state — refresh snapshot for variables",
      template: `<eos-container><p class="muted">Fetches current music snapshot into variables.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.getState();
        rememberSnapshot(res);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: res } };
      },
    })
  );

  // ----- Transport -----
  effects.push(
    makeEffect({
      id: "skip",
      name: "Skip",
      description: "POST /skip",
      template: `<eos-container><p class="muted">Skip current track.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.skip();
        const snap = (res as { snapshot?: unknown }).snapshot ?? res;
        rememberSnapshot(snap);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: snap } };
      },
    }),
    makeEffect({
      id: "play",
      name: "Play",
      description: "POST /play",
      template: `<eos-container><p class="muted">Resume playback.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.play();
        const snap = (res as { snapshot?: unknown }).snapshot ?? res;
        rememberSnapshot(snap);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: snap } };
      },
    }),
    makeEffect({
      id: "pause",
      name: "Pause",
      description: "POST /pause",
      template: `<eos-container><p class="muted">Pause playback.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.pause();
        const snap = (res as { snapshot?: unknown }).snapshot ?? res;
        rememberSnapshot(snap);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: snap } };
      },
    }),
    makeEffect({
      id: "toggle-play-pause",
      name: "Toggle Play/Pause",
      description: "Pause when playing; otherwise play (GET /state → POST /play|/pause)",
      template: `<eos-container><p class="muted">One button: pause if the queue is playing, otherwise resume.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.togglePlayPause();
        const snap = (res as { snapshot?: unknown }).snapshot ?? res;
        rememberSnapshot(snap);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: snap } };
      },
    })
  );

  effects.push(
    makeEffect({
      id: "volume",
      name: "Volume",
      description: "POST /volume",
      template: field("volume", "Volume 0–100", { type: "number", placeholder: "50" }),
      validate: (e) => {
        const n = Number(e.volume);
        if (!Number.isFinite(n) || n < 0 || n > 100) return ["Volume must be 0-100"];
        return [];
      },
      run: async ({ effect, api }) => {
        const res = await api.volume(Number(effect.volume));
        rememberSnapshot(res);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: res } };
      },
    }),
    makeEffect({
      id: "seek",
      name: "Seek",
      description: "POST /seek — absolute seconds or delta",
      template:
        field("seconds", "Absolute seconds (optional)", { type: "number" }) +
        field("delta", "Delta seconds (optional)", { type: "number", placeholder: "10" }),
      run: async ({ effect, api }) => {
        const body: { seconds?: number; delta?: number } = {};
        if (str(effect.seconds) !== "") body.seconds = Number(effect.seconds);
        if (str(effect.delta) !== "") body.delta = Number(effect.delta);
        const res = await api.seek(body);
        rememberSnapshot((res as { snapshot?: unknown }).snapshot);
        return { outputs: { apiResponse: JSON.stringify(res), snapshot: (res as { snapshot?: unknown }).snapshot } };
      },
    }),
    makeEffect({
      id: "leader",
      name: "Claim leader",
      description: "POST /leader",
      template: field("sessionId", "Player session id"),
      validate: (e) => (!String(e.sessionId ?? "").trim() ? ["sessionId required"] : []),
      run: async ({ effect, api }) => {
        const res = await api.leader(str(effect.sessionId));
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    })
  );

  // ----- Settings -----
  effects.push(
    makeEffect({
      id: "get-settings",
      name: "Get settings",
      description: "GET /settings",
      template: `<eos-container><p class="muted">Load music module settings JSON.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.getSettings();
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "patch-settings",
      name: "Patch settings",
      description: "PATCH /settings — JSON body (partial)",
      template: field("patchJson", "Settings patch JSON", {
        textarea: true,
        placeholder: '{"chatCommandsVia":"external"}',
      }),
      validate: (e) => {
        const s = String(e.patchJson ?? "").trim();
        if (!s) return ["Patch JSON is required"];
        try {
          JSON.parse(s);
          return [];
        } catch {
          return ["Patch must be valid JSON"];
        }
      },
      run: async ({ effect, api }) => {
        const patch = parseJsonField(effect.patchJson, "Patch") as Record<string, unknown>;
        const res = await api.patchSettings(patch);
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "set-chat-via",
      name: "Set chatCommandsVia",
      description: "Shortcut: vulkanchik | external",
      template: field("via", "Mode", { placeholder: "external" }),
      validate: (e) => {
        const v = String(e.via ?? "").trim();
        if (v !== "external" && v !== "vulkanchik") return ["Must be external or vulkanchik"];
        return [];
      },
      run: async ({ effect, api }) => {
        const res = await api.patchSettings({ chatCommandsVia: str(effect.via) });
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "toggle-accept-chat",
      name: "Set acceptChatRequests",
      description: "PATCH acceptChatRequests true/false",
      template: checkbox("enabled", "Accept chat requests"),
      run: async ({ effect, api }) => {
        const res = await api.patchSettings({ acceptChatRequests: Boolean(effect.enabled) });
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "toggle-accept-points",
      name: "Set acceptPointsRequests",
      description: "PATCH acceptPointsRequests true/false",
      template: checkbox("enabled", "Accept Channel Points requests"),
      run: async ({ effect, api }) => {
        const res = await api.patchSettings({ acceptPointsRequests: Boolean(effect.enabled) });
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    })
  );

  // ----- Backup -----
  effects.push(
    makeEffect({
      id: "get-backup",
      name: "Get backup",
      description: "GET /backup",
      template: `<eos-container><p class="muted">Fetch backup playlist.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.getBackup();
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "put-backup",
      name: "Put backup",
      description: "PUT /backup",
      template:
        checkbox("enabled", "Backup enabled") +
        field("urls", "URLs (one per line)", { textarea: true }) +
        field("mode", "Mode", { placeholder: "replace | merge" }) +
        field("sourcePlaylistUrl", "Source playlist URL (optional)"),
      run: async ({ effect, api }) => {
        const body: {
          enabled: boolean;
          urls: string[];
          mode?: string;
          sourcePlaylistUrl?: string | null;
        } = {
          enabled: Boolean(effect.enabled),
          urls: parseUrls(effect.urls),
        };
        if (str(effect.mode)) body.mode = str(effect.mode);
        if (str(effect.sourcePlaylistUrl)) body.sourcePlaylistUrl = str(effect.sourcePlaylistUrl);
        const res = await api.putBackup(body);
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "import-backup",
      name: "Import backup playlist",
      description: "POST /backup/import",
      template:
        field("playlistUrl", "Playlist / album / track URL") +
        field("mode", "Mode", { placeholder: "merge" }),
      validate: (e) => (!String(e.playlistUrl ?? "").trim() ? ["playlistUrl required"] : []),
      run: async ({ effect, api }) => {
        const body: { playlistUrl: string; mode?: string } = {
          playlistUrl: str(effect.playlistUrl),
        };
        if (str(effect.mode)) body.mode = str(effect.mode);
        const res = await api.importBackup(body);
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    })
  );

  // ----- Points -----
  effects.push(
    makeEffect({
      id: "points-list",
      name: "List points mappings",
      description: "GET /points/rewards",
      template: `<eos-container><p class="muted">List Channel Points → music mappings.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.listPointsRewards();
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "points-twitch-list",
      name: "List Twitch rewards",
      description: "GET /points/twitch-rewards",
      template: `<eos-container><p class="muted">Helix custom rewards on the channel.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.listTwitchRewards();
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "points-add",
      name: "Add points mapping",
      description: "POST /points/rewards",
      template:
        field("rewardId", "Twitch reward id") +
        field("rewardTitle", "Title (optional)") +
        field("minRole", "minRole", { placeholder: "everyone" }) +
        checkbox("autoRefundPoints", "Auto-refund points"),
      validate: (e) => (!String(e.rewardId ?? "").trim() ? ["rewardId required"] : []),
      run: async ({ effect, api }) => {
        const body: Record<string, unknown> = {
          rewardId: str(effect.rewardId),
          autoRefundPoints: Boolean(effect.autoRefundPoints),
        };
        if (str(effect.rewardTitle)) body.rewardTitle = str(effect.rewardTitle);
        if (str(effect.minRole)) body.minRole = str(effect.minRole);
        const res = await api.addPointsReward(body);
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "points-update",
      name: "Update points mapping",
      description: "PATCH /points/rewards/:id",
      template:
        field("mappingId", "Mapping id (cuid)") +
        field("rewardTitle", "Title (optional)") +
        field("minRole", "minRole (optional)") +
        field("autoRefundPoints", "autoRefundPoints true/false (optional)"),
      validate: (e) => (!String(e.mappingId ?? "").trim() ? ["mappingId required"] : []),
      run: async ({ effect, api }) => {
        const body: Record<string, unknown> = {};
        if (str(effect.rewardTitle)) body.rewardTitle = str(effect.rewardTitle);
        if (str(effect.minRole)) body.minRole = str(effect.minRole);
        const ar = str(effect.autoRefundPoints).toLowerCase();
        if (ar === "true" || ar === "false") body.autoRefundPoints = ar === "true";
        const res = await api.patchPointsReward(str(effect.mappingId), body);
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    }),
    makeEffect({
      id: "points-delete",
      name: "Delete points mapping",
      description: "DELETE /points/rewards/:id",
      template: field("mappingId", "Mapping id (cuid)"),
      validate: (e) => (!String(e.mappingId ?? "").trim() ? ["mappingId required"] : []),
      run: async ({ effect, api }) => {
        const res = await api.deletePointsReward(str(effect.mappingId));
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    })
  );

  // ----- Roles -----
  effects.push(
    makeEffect({
      id: "roles-get",
      name: "Get roles",
      description: "GET /roles",
      template: `<eos-container><p class="muted">Fetch rolesJson config.</p></eos-container>`,
      run: async ({ api }) => {
        const res = await api.getRoles();
        rememberRoles(res);
        return { outputs: { apiResponse: JSON.stringify(res), rolesJson: JSON.stringify(res) } };
      },
      outputs: [
        { label: "Roles JSON", description: "Roles config", defaultName: "rolesJson" },
        { label: "Response JSON", description: "Raw", defaultName: "apiResponse" },
      ],
    }),
    makeEffect({
      id: "roles-put",
      name: "Put roles",
      description: "PUT /roles — full roles config JSON (destructive)",
      template: field("rolesJson", "Roles config JSON", {
        textarea: true,
        placeholder: '{"custom":[],"assignments":[]}',
      }),
      validate: (e) => {
        const s = String(e.rolesJson ?? "").trim();
        if (!s) return ["Roles JSON is required"];
        try {
          JSON.parse(s);
          return [];
        } catch {
          return ["Roles must be valid JSON"];
        }
      },
      run: async ({ effect, api }) => {
        const body = parseJsonField(effect.rolesJson, "Roles");
        const res = await api.putRoles(body);
        rememberRoles(res);
        return { outputs: { apiResponse: JSON.stringify(res) } };
      },
    })
  );

  return effects;
}

/** Used by auto-chat: forward a chat line via POST /chat. */
export async function runAutoChatCommand(opts: {
  message: string;
  chatterTwitchId: string;
  chatterName?: string;
  chatterLogin?: string;
  badges?: unknown;
}): Promise<void> {
  const { apiFromParams } = await import("../config");
  const api = apiFromParams();
  const res = (await api.chat({
    message: opts.message,
    chatterTwitchId: opts.chatterTwitchId,
    chatterName: opts.chatterName,
    chatterLogin: opts.chatterLogin,
    badges: opts.badges,
    postReply: false,
  })) as { replies?: string[]; snapshot?: unknown };
  if (res.snapshot) rememberSnapshot(res.snapshot);
  const params = readParams();
  if (params.postRepliesToChat && res.replies?.length) {
    await sendChatLines(res.replies);
  }
}

export { metaUser };
