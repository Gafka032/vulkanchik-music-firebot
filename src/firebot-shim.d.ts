/**
 * Minimal typings for the Firebot host API injected at runtime via
 * `require("@crowbartools/firebot-types")`. Keep in sync with Firebot 5.67+ Plugin surface.
 */
/** Injected by scripts/build.mjs from package.json version. */
declare const __PLUGIN_VERSION__: string;

declare module "@crowbartools/firebot-types" {
  export type EffectCategory =
    | "common"
    | "twitch"
    | "chat based"
    | "integrations"
    | "advanced"
    | "scripting";

  export type EffectTriggerResponse = {
    success: boolean;
    outputs?: Record<string, unknown>;
  };

  export type EffectType<EffectModel = unknown> = {
    definition: {
      id: string;
      name: string;
      description: string;
      icon: string;
      categories: EffectCategory[];
      outputs?: Array<{ label: string; description: string; defaultName: string }>;
    };
    optionsTemplate: string;
    optionsValidator?: (effect: EffectModel) => string[];
    onTriggerEvent: (event: {
      effect: EffectModel & Record<string, unknown>;
      trigger: {
        type?: string;
        metadata?: Record<string, unknown>;
      };
    }) => void | boolean | EffectTriggerResponse | Promise<void | boolean | EffectTriggerResponse>;
  };

  export type ReplaceVariable = {
    definition: {
      handle: string;
      description: string;
      categories?: string[];
      possibleDataOutput?: Array<"text" | "number">;
    };
    evaluator: (trigger: { metadata?: Record<string, unknown> }, ...args: string[]) => unknown;
  };

  export type FirebotParameterArray = Array<{
    name: string;
    type: string;
    title?: string;
    description?: string;
    default?: unknown;
    useTextArea?: boolean;
  }>;

  export type PluginContext = {
    parameters: Record<string, unknown>;
  };

  export type Plugin = {
    manifest: {
      name: string;
      version: string;
      author: string;
      description: string;
      type?: string;
      tags?: string[];
      website?: string;
      minimumFirebotVersion?: { major: number; minor?: number; patch?: number };
    };
    parametersSchema?: FirebotParameterArray;
    registers?: {
      effects?: EffectType[];
      variables?: ReplaceVariable[];
    };
    onLoad?: (context: PluginContext, isInstalling?: boolean) => void | Promise<void>;
    onUnload?: (context: PluginContext, isUninstalling?: boolean) => void | Promise<void>;
    onParameterUpdate?: (context: PluginContext) => void | Promise<void>;
  };

  export type FirebotPluginApi = {
    version: string;
    logger: {
      debug: (msg: string, ...meta: unknown[]) => void;
      info: (msg: string, ...meta: unknown[]) => void;
      warn: (msg: string, ...meta: unknown[]) => void;
      error: (msg: string, ...meta: unknown[]) => void;
    };
    parameters: {
      getAll: <T extends Record<string, unknown>>() => T;
    };
    events: {
      onTriggered: (handler: (event: {
        eventSourceId?: string;
        eventId?: string;
        meta?: Record<string, unknown>;
      }) => void) => () => void;
    };
    effects: {
      processEffects: (context: {
        trigger: { type: string; metadata?: Record<string, unknown> };
        effects: { id: string; list: Array<Record<string, unknown>> };
      }) => Promise<void>;
    };
    twitch: {
      api: {
        chat?: {
          sendChatMessage?: (message: string, whisperTarget?: string | null, accountType?: string) => Promise<void>;
        };
      };
    };
  };

  const firebot: FirebotPluginApi;
  export default firebot;
}
