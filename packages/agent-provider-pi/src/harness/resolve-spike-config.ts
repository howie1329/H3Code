import type { PiAuthOptions } from "@ai-sdk/harness-pi";

/** Curated gateway models for spike testing — gateway id format `provider/model`. */
export const SPIKE_GATEWAY_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4.6",
] as const;

const GATEWAY_DEFAULT_MODEL = SPIKE_GATEWAY_MODELS[0];
const OPENAI_DIRECT_DEFAULT_MODEL = "gpt-4o-mini";
const ANTHROPIC_DIRECT_DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

export type SpikeAuthMode = "gateway" | "direct";

export type SpikeConfig = {
  authMode: SpikeAuthMode;
  auth: PiAuthOptions;
  model: string;
  thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
};

function readGatewayKey(): string | undefined {
  return (
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    undefined
  );
}

function readDirectProviderEnv(): Record<string, string> {
  const customEnv: Record<string, string> = {};

  for (const key of [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
  ]) {
    const value = process.env[key]?.trim();
    if (value) {
      customEnv[key] = value;
    }
  }

  return customEnv;
}

function resolveAuthMode(): SpikeAuthMode {
  const forced = process.env.H3_SPIKE_AUTH?.trim();
  if (forced === "gateway" || forced === "direct") {
    return forced;
  }

  if (readGatewayKey()) {
    return "gateway";
  }

  const direct = readDirectProviderEnv();
  if (direct.OPENAI_API_KEY || direct.ANTHROPIC_API_KEY) {
    return "direct";
  }

  throw new Error(
    [
      "Set AI_GATEWAY_API_KEY for the harness spike (recommended),",
      "or OPENAI_API_KEY / ANTHROPIC_API_KEY for direct provider auth.",
    ].join(" "),
  );
}

function resolveDefaultModel(authMode: SpikeAuthMode, directEnv: Record<string, string>): string {
  const explicitModel = process.env.H3_SPIKE_MODEL?.trim();
  if (explicitModel) {
    return explicitModel;
  }

  if (authMode === "gateway") {
    return GATEWAY_DEFAULT_MODEL;
  }

  const hasOpenAi = Boolean(directEnv.OPENAI_API_KEY);
  const hasAnthropic = Boolean(directEnv.ANTHROPIC_API_KEY);

  if (hasOpenAi && !hasAnthropic) {
    return OPENAI_DIRECT_DEFAULT_MODEL;
  }

  if (hasAnthropic) {
    return ANTHROPIC_DIRECT_DEFAULT_MODEL;
  }

  if (hasOpenAi) {
    return OPENAI_DIRECT_DEFAULT_MODEL;
  }

  throw new Error("No direct provider API key found.");
}

function resolveThinkingLevel(model: string): SpikeConfig["thinkingLevel"] {
  const explicit = process.env.H3_SPIKE_THINKING_LEVEL?.trim();
  if (
    explicit === "off" ||
    explicit === "minimal" ||
    explicit === "low" ||
    explicit === "medium" ||
    explicit === "high" ||
    explicit === "xhigh"
  ) {
    return explicit;
  }

  if (model.startsWith("gpt-") || model.includes("/gpt-")) {
    return "off";
  }

  return "medium";
}

function resolveAuth(authMode: SpikeAuthMode): PiAuthOptions {
  if (authMode === "gateway") {
    const apiKey = readGatewayKey();
    if (!apiKey) {
      throw new Error("Set AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN) for gateway auth.");
    }

    const baseUrl = process.env.AI_GATEWAY_BASE_URL?.trim();
    return {
      gateway: {
        apiKey,
        ...(baseUrl ? { baseUrl } : {}),
      },
    };
  }

  const customEnv = readDirectProviderEnv();
  if (!customEnv.OPENAI_API_KEY && !customEnv.ANTHROPIC_API_KEY) {
    throw new Error("Set OPENAI_API_KEY or ANTHROPIC_API_KEY for direct provider auth.");
  }

  return { customEnv };
}

export function resolveSpikeConfig(): SpikeConfig {
  const authMode = resolveAuthMode();
  const directEnv = readDirectProviderEnv();
  const model = resolveDefaultModel(authMode, directEnv);

  return {
    authMode,
    auth: resolveAuth(authMode),
    model,
    thinkingLevel: resolveThinkingLevel(model),
  };
}
