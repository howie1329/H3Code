export type ProviderCommandSource = "extension" | "prompt" | "skill";

export type ProviderCommand = {
  name: string;
  description?: string;
  source: ProviderCommandSource;
  location?: string;
  path?: string;
  sourceInfo?: {
    path?: string;
    source?: string;
    scope?: string;
    origin?: string;
    baseDir?: string;
  };
};

export type ProviderModel = {
  id: string;
  provider: string;
  name?: string;
  modelId?: string;
  reasoning?: boolean;
};

export type ProviderQueueMode = "all" | "one-at-a-time";
