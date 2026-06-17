import type { PiAuthOptions } from "@ai-sdk/harness-pi";

export const DESKTOP_GATEWAY_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4.6",
] as const;

const GATEWAY_DEFAULT_MODEL = DESKTOP_GATEWAY_MODELS[0];
const OPENAI_DIRECT_DEFAULT_MODEL = "gpt-4o-mini";
const ANTHROPIC_DIRECT_DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

export type DesktopAuthMode = "gateway" | "direct";

export type DesktopAuthConfig = {
  gatewayApiKey?: string;
  gatewayBaseUrl?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  anthropicApiKey?: string;
  anthropicBaseUrl?: string;
  anthropicAuthToken?: string;
  model?: string;
  thinkingLevel?: DesktopHarnessConfig["thinkingLevel"];
  authMode?: DesktopAuthMode;
};

export type DesktopHarnessConfig = {
  authMode: DesktopAuthMode;
  auth: PiAuthOptions;
  model: string;
  thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
};

function readGatewayKey(config?: DesktopAuthConfig): string | undefined {
  return (
    config?.gatewayApiKey?.trim() ||
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    undefined
  );
}

function readDirectProviderEnv(config?: DesktopAuthConfig): Record<string, string> {
  const customEnv: Record<string, string> = {};

  const entries: Array<[string, string | undefined]> = [
    ["ANTHROPIC_API_KEY", config?.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY],
    ["ANTHROPIC_BASE_URL", config?.anthropicBaseUrl ?? process.env.ANTHROPIC_BASE_URL],
    ["ANTHROPIC_AUTH_TOKEN", config?.anthropicAuthToken ?? process.env.ANTHROPIC_AUTH_TOKEN],
    ["OPENAI_API_KEY", config?.openaiApiKey ?? process.env.OPENAI_API_KEY],
    ["OPENAI_BASE_URL", config?.openaiBaseUrl ?? process.env.OPENAI_BASE_URL],
  ];

  for (const [key, value] of entries) {
    const trimmed = value?.trim();
    if (trimmed) {
      customEnv[key] = trimmed;
    }
  }

  return customEnv;
}

function resolveAuthMode(config?: DesktopAuthConfig): DesktopAuthMode {
  if (config?.authMode === "gateway" || config?.authMode === "direct") {
    return config.authMode;
  }

  if (readGatewayKey(config)) {
    return "gateway";
  }

  const direct = readDirectProviderEnv(config);
  if (direct.OPENAI_API_KEY || direct.ANTHROPIC_API_KEY) {
    return "direct";
  }

  throw new Error(
    [
      "Configure AI_GATEWAY_API_KEY for harness gateway auth (recommended),",
      "or OPENAI_API_KEY / ANTHROPIC_API_KEY for direct provider auth.",
    ].join(" "),
  );
}

function resolveDefaultModel(
  authMode: DesktopAuthMode,
  directEnv: Record<string, string>,
  config?: DesktopAuthConfig,
): string {
  const explicitModel = config?.model?.trim();
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

function resolveThinkingLevel(
  model: string,
  config?: DesktopAuthConfig,
): DesktopHarnessConfig["thinkingLevel"] {
  const explicit = config?.thinkingLevel;
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

function resolveAuth(authMode: DesktopAuthMode, config?: DesktopAuthConfig): PiAuthOptions {
  if (authMode === "gateway") {
    const apiKey = readGatewayKey(config);
    if (!apiKey) {
      throw new Error("Set AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN) for gateway auth.");
    }

    const baseUrl =
      config?.gatewayBaseUrl?.trim() || process.env.AI_GATEWAY_BASE_URL?.trim() || undefined;

    return {
      gateway: {
        apiKey,
        ...(baseUrl ? { baseUrl } : {}),
      },
    };
  }

  const customEnv = readDirectProviderEnv(config);
  if (!customEnv.OPENAI_API_KEY && !customEnv.ANTHROPIC_API_KEY) {
    throw new Error("Set OPENAI_API_KEY or ANTHROPIC_API_KEY for direct provider auth.");
  }

  return { customEnv };
}

export function resolveDesktopHarnessConfig(config?: DesktopAuthConfig): DesktopHarnessConfig {
  const authMode = resolveAuthMode(config);
  const directEnv = readDirectProviderEnv(config);
  const model = resolveDefaultModel(authMode, directEnv, config);

  return {
    authMode,
    auth: resolveAuth(authMode, config),
    model,
    thinkingLevel: resolveThinkingLevel(model, config),
  };
}
