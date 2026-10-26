import firebot from "@crowbartools/firebot-types";
import { MusicApiError } from "./api";
import { readParams } from "./config";
import { metaUser, runAutoChatCommand } from "./effects/all";

let unsubscribe: (() => void) | null = null;

function looksLikeCommand(text: string): boolean {
  return text.trimStart().startsWith("!");
}

function extractMessage(meta: Record<string, unknown>): string {
  if (typeof meta.messageText === "string") return meta.messageText;
  if (typeof meta.chatMessage === "string") return meta.chatMessage;
  if (typeof meta.message === "string") return meta.message;
  const nested = meta.chatMessage;
  if (nested && typeof nested === "object") {
    const t = (nested as { text?: string; messageText?: string }).text
      ?? (nested as { messageText?: string }).messageText;
    if (typeof t === "string") return t;
  }
  return "";
}

function extractBadges(meta: Record<string, unknown>): unknown {
  if (meta.badges != null) return meta.badges;
  if (Array.isArray(meta.userBadges)) return meta.userBadges;
  const tags = meta.tags;
  if (tags && typeof tags === "object") {
    const t = tags as Record<string, unknown>;
    return {
      broadcaster: Boolean(t.broadcaster || t.badges?.toString?.().includes("broadcaster")),
      mod: Boolean(t.mod || t.moderator),
      vip: Boolean(t.vip),
      subscriber: Boolean(t.subscriber),
    };
  }
  return undefined;
}

export function startAutoChat(): void {
  stopAutoChat();
  unsubscribe = firebot.events.onTriggered((event) => {
    try {
      const params = readParams();
      if (!params.autoChatCommands) return;
      const source = String(event.eventSourceId ?? "");
      const id = String(event.eventId ?? "");
      // Firebot uses various ids; accept common chat message events.
      const isChat =
        id.toLowerCase().includes("chat") ||
        (source.toLowerCase().includes("twitch") && id.toLowerCase().includes("message")) ||
        id === "chat-message" ||
        id === "chatMessage";
      const meta = (event.meta ?? {}) as Record<string, unknown>;
      if (!isChat && !extractMessage(meta)) return;
      const message = extractMessage(meta).trim();
      if (!message || !looksLikeCommand(message)) return;
      const user = metaUser({ metadata: meta });
      if (!user.userId) {
        firebot.logger.warn("Vulkanchik auto-chat: missing chatter Twitch user id");
        return;
      }
      void runAutoChatCommand({
        message,
        chatterTwitchId: user.userId,
        chatterName: user.display || undefined,
        chatterLogin: user.username || undefined,
        badges: extractBadges(meta),
      }).catch((err) => {
        const msg =
          err instanceof MusicApiError
            ? `${err.message}${err.code ? ` (${err.code})` : ""}`
            : err instanceof Error
              ? err.message
              : String(err);
        firebot.logger.error(`Vulkanchik auto-chat failed: ${msg}`);
      });
    } catch (err) {
      firebot.logger.error(
        `Vulkanchik auto-chat handler error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });
  firebot.logger.info("Vulkanchik: auto chat command forwarding armed");
}

export function stopAutoChat(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
