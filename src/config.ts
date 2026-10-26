import firebot from "@crowbartools/firebot-types";
import { createMusicApi, type MusicApi } from "./api";

export type PluginParams = {
  apiBaseUrl: string;
  apiToken: string;
  autoChatCommands: boolean;
  postRepliesToChat: boolean;
};

export function readParams(): PluginParams {
  const all = firebot.parameters.getAll<Partial<PluginParams>>() || {};
  return {
    apiBaseUrl: String(all.apiBaseUrl ?? "https://vulkanchik.com"),
    apiToken: String(all.apiToken ?? ""),
    autoChatCommands: Boolean(all.autoChatCommands),
    postRepliesToChat: all.postRepliesToChat !== false,
  };
}

export function apiFromParams(): MusicApi {
  const p = readParams();
  return createMusicApi({ apiBaseUrl: p.apiBaseUrl, apiToken: p.apiToken });
}

export async function sendChatLines(lines: string[]): Promise<void> {
  if (!lines.length) return;
  const chat = firebot.twitch?.api?.chat;
  if (!chat?.sendChatMessage) {
    firebot.logger.warn("Vulkanchik: cannot post replies — chat API unavailable");
    return;
  }
  for (const line of lines) {
    const msg = String(line || "").trim();
    if (!msg) continue;
    try {
      await chat.sendChatMessage(msg, null, "bot");
    } catch (err) {
      firebot.logger.warn(
        `Vulkanchik: chat reply failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
