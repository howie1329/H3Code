export type ProviderCapabilities = {
  streaming: boolean;
  sessionResume: boolean;
  approvals: boolean;
  userInputRequests: boolean;
  cancellation: boolean;
  attachments: boolean;
  modes?: ProviderMode[];
  controls?: ProviderControlCapabilities;
  tools?: ProviderToolCapability[];
  models?: ProviderModelCapability[];
  metadata?: Record<string, unknown>;
};

export type ProviderMode = "default" | "plan";

export type ProviderControlCapabilities = {
  slashCommands?: boolean;
  model?: boolean;
  thinkingLevel?: boolean;
  queueSettings?: boolean;
  autoCompaction?: boolean;
  sessionSwitching?: boolean;
  sessionDeletion?: boolean;
};

export type ProviderToolCapability = {
  name: string;
  description?: string;
};

export type ProviderModelCapability = {
  id: string;
  name?: string;
  contextWindow?: number;
};
