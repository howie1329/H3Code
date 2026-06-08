export type ProviderCapabilities = {
  streaming: boolean;
  sessionResume: boolean;
  approvals: boolean;
  userInputRequests: boolean;
  cancellation: boolean;
  attachments: boolean;
  modes?: ProviderMode[];
  tools?: ProviderToolCapability[];
  models?: ProviderModelCapability[];
  metadata?: Record<string, unknown>;
};

export type ProviderMode = "default" | "plan";

export type ProviderToolCapability = {
  name: string;
  description?: string;
};

export type ProviderModelCapability = {
  id: string;
  name?: string;
  contextWindow?: number;
};
