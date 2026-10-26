import type { EffectType } from "@crowbartools/firebot-types";
import firebot from "@crowbartools/firebot-types";
import { MusicApiError, rememberSnapshot } from "./api";
import { apiFromParams, sendChatLines, readParams } from "./config";

const CAT = ["integrations", "chat based"] as const;

export function field(
  key: string,
  label: string,
  opts: { textarea?: boolean; placeholder?: string; type?: string } = {}
): string {
  const input = opts.textarea
    ? `<textarea class="form-control" ng-model="effect.${key}" placeholder="${opts.placeholder ?? ""}" rows="3" replace-variables></textarea>`
    : `<input class="form-control" type="${opts.type ?? "text"}" ng-model="effect.${key}" placeholder="${opts.placeholder ?? ""}" replace-variables />`;
  return `<eos-container header="${label}">${input}</eos-container>`;
}

export function checkbox(key: string, label: string): string {
  return `<eos-container>
    <label class="control-fb control--checkbox">${label}
      <input type="checkbox" ng-model="effect.${key}" />
      <div class="control__indicator"></div>
    </label>
  </eos-container>`;
}

type RunFn = (ctx: {
  effect: Record<string, unknown>;
  trigger: { metadata?: Record<string, unknown> };
  api: ReturnType<typeof apiFromParams>;
}) => Promise<{ outputs?: Record<string, unknown>; chatLines?: string[] } | void>;

export function makeEffect(opts: {
  id: string;
  name: string;
  description: string;
  icon?: string;
  template: string;
  validate?: (effect: Record<string, unknown>) => string[];
  run: RunFn;
  outputs?: Array<{ label: string; description: string; defaultName: string }>;
}): EffectType {
  return {
    definition: {
      id: `vulkanchik:music:${opts.id}`,
      name: `Vulkanchik: ${opts.name}`,
      description: opts.description,
      icon: opts.icon ?? "fad fa-music",
      categories: [...CAT],
      outputs: opts.outputs ?? [
        { label: "Response JSON", description: "Raw API JSON", defaultName: "apiResponse" },
      ],
    },
    optionsTemplate: opts.template,
    // Firebot serializes this via .toString() and eval()s it in the renderer.
    // Must be a self-contained function (no closures over str/opts/module helpers).
    optionsValidator: (opts.validate ?? (() => [])) as EffectType["optionsValidator"],
    onTriggerEvent: async (event) => {
      try {
        const api = apiFromParams();
        const result = await opts.run({
          effect: event.effect as Record<string, unknown>,
          trigger: event.trigger,
          api,
        });
        const outputs = result?.outputs ?? {};
        if (outputs.snapshot) rememberSnapshot(outputs.snapshot);
        if (outputs.state && typeof outputs.state === "object") rememberSnapshot(outputs.state);
        const params = readParams();
        if (params.postRepliesToChat && result?.chatLines?.length) {
          await sendChatLines(result.chatLines);
        }
        return { success: true, outputs: { apiOk: true, ...outputs } };
      } catch (err) {
        const msg =
          err instanceof MusicApiError
            ? `${err.message}${err.code ? ` (${err.code})` : ""}`
            : err instanceof Error
              ? err.message
              : String(err);
        firebot.logger.error(`Vulkanchik effect ${opts.id} failed: ${msg}`);
        // Soft-fail: always success so a broken / timed-out call does not abort later
        // effects in the same Firebot list (API errors land in outputs + log).
        return {
          success: true,
          outputs: {
            apiOk: false,
            apiError: msg,
            apiCode: err instanceof MusicApiError ? (err.code ?? "") : "",
          },
        };
      }
    },
  };
}

export function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function parseJsonField(raw: unknown, label: string): unknown {
  const s = str(raw);
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

export function parseIds(raw: unknown): string[] {
  return str(raw)
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseUrls(raw: unknown): string[] {
  return str(raw)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
