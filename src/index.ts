import type { Plugin } from "@crowbartools/firebot-types";
import firebot from "@crowbartools/firebot-types";
import { startAutoChat, stopAutoChat } from "./autoChat";
import { buildAllEffects } from "./effects/all";
import { readParams } from "./config";
import { buildAllVariables } from "./variables/all";

const PLUGIN_VERSION =
  typeof __PLUGIN_VERSION__ !== "undefined" ? __PLUGIN_VERSION__ : "0.0.0-dev";

const plugin: Plugin = {
  manifest: {
    name: "Vulkanchik Music",
    version: PLUGIN_VERSION,
    author: "Vulkanchik",
    description:
      "Vulkanchik music queue for Firebot 5.67+. How to use: (1) create mct_ token on Music → API, (2) set chat mode to external bot on the site, (3) Configure this plugin with origin + token and enable Auto-forward. Chat aliases (!замов, !скіп, …) are edited on the website, not here. Effects: Skip/Play/Pause/Enqueue under Vulkanchik Music. Help: https://vulkanchik.com → Music → API → «Як користуватись?»",
    type: "plugin",
    tags: ["music", "vulkanchik", "twitch", "song-request"],
    website: "https://vulkanchik.com/docs/music-api",
    minimumFirebotVersion: { major: 5, minor: 67 },
  },
  parametersSchema: [
    {
      name: "apiBaseUrl",
      type: "string",
      title: "Site origin",
      description:
        "https://vulkanchik.com (or your domain). Plugin appends /api/music/v1. See Music → API → «Як користуватись?» on the site.",
      default: "https://vulkanchik.com",
    },
    {
      name: "apiToken",
      type: "password",
      title: "Music API token",
      description:
        "Create under Music → API (mct_…, shown once). Keep secret — revoke on the site if leaked.",
      default: "",
    },
    {
      name: "autoChatCommands",
      type: "boolean",
      title: "Auto-forward !chat commands",
      description:
        "Forward chat lines starting with ! to Vulkanchik (POST /chat). Requires «Мій бот (через API)» on the site. Do not also create Firebot Chat Commands for the same !aliases. Defaults: !замов !зараз !черга !прибрати !скіп !грати !пауза !гучність.",
      default: true,
    },
    {
      name: "postRepliesToChat",
      type: "boolean",
      title: "Post API replies to Twitch chat",
      description:
        "When Auto-forward handles a command, post Vulkanchik reply lines (queue added, errors, …) via Firebot chat.",
      default: true,
    },
  ],
  registers: {
    effects: buildAllEffects(),
    variables: buildAllVariables(),
  },
  onLoad: () => {
    firebot.logger.info(`Vulkanchik Music plugin v${PLUGIN_VERSION} loaded (Firebot ${firebot.version})`);
    const p = readParams();
    if (p.autoChatCommands) startAutoChat();
  },
  onUnload: () => {
    stopAutoChat();
    firebot.logger.info("Vulkanchik Music plugin unloaded");
  },
  onParameterUpdate: () => {
    stopAutoChat();
    if (readParams().autoChatCommands) startAutoChat();
  },
};

export default plugin;
