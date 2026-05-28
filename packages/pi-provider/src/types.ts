import type {
  AgentSessionRuntimeDiagnostic,
  AuthStorage,
  ModelRegistry,
  ResourceLoader,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

export type PiProviderSessionMode = "create" | "open" | "continueRecent";
export type PiProviderThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type PiProviderQueueMode = "all" | "one-at-a-time";
export type PiProviderSendSource = "extension" | "prompt" | "skill" | "interactive";
export type PiProviderUiRequestKind = "select" | "confirm" | "input" | "editor";

export interface PiProviderSessionTarget {
  mode: PiProviderSessionMode;
  sessionPath?: string;
}

export interface PiProviderOptions {
  cwd: string;
  agentDir?: string;
  session?: PiProviderSessionTarget;
  authStorage?: AuthStorage;
  modelRegistry?: ModelRegistry;
  resourceLoader?: ResourceLoader;
  settingsManager?: SettingsManager;
  runtimeFactory?: PiRuntimeFactory;
}

export interface PiRuntimeFactoryOptions {
  cwd: string;
  agentDir: string;
  session: PiProviderSessionTarget;
  authStorage?: AuthStorage;
  modelRegistry?: ModelRegistry;
  resourceLoader?: ResourceLoader;
  settingsManager?: SettingsManager;
}

export type PiRuntimeFactory = (options: PiRuntimeFactoryOptions) => Promise<PiRuntimeLike>;

export interface PiRuntimeLike {
  readonly cwd: string;
  readonly session: PiSessionLike;
  readonly diagnostics?: readonly AgentSessionRuntimeDiagnostic[];
  readonly modelFallbackMessage?: string | undefined;
  setRebindSession?(rebindSession?: (session: PiSessionLike) => Promise<void>): void;
  newSession(options?: { parentSession?: string }): Promise<{ cancelled: boolean }>;
  switchSession(sessionPath: string, options?: { cwdOverride?: string }): Promise<{ cancelled: boolean }>;
  fork?(entryId: string, options?: { position?: "before" | "at" }): Promise<{ cancelled: boolean; selectedText?: string }>;
  importFromJsonl?(inputPath: string, cwdOverride?: string): Promise<{ cancelled: boolean }>;
  dispose(): Promise<void>;
}

export interface PiSessionLike {
  readonly sessionFile: string | undefined;
  readonly sessionId: string;
  readonly sessionName?: string | undefined;
  readonly messages: unknown[];
  readonly isStreaming: boolean;
  readonly isCompacting?: boolean;
  readonly model?: unknown;
  readonly thinkingLevel?: string;
  readonly steeringMode?: PiProviderQueueMode;
  readonly followUpMode?: PiProviderQueueMode;
  readonly promptTemplates?: readonly unknown[];
  subscribe(listener: (event: unknown) => void): () => void;
  bindExtensions?(bindings: unknown): Promise<void>;
  prompt(text: string, options?: PiPromptOptions): Promise<void>;
  steer(text: string, images?: unknown[]): Promise<void>;
  followUp(text: string, images?: unknown[]): Promise<void>;
  abort(): Promise<void>;
  setModel?(model: unknown): Promise<void>;
  setThinkingLevel?(level: string): void;
  getSessionStats?(): unknown;
  getActiveToolNames?(): string[];
  getAllTools?(): unknown[];
  getSteeringMessages?(): readonly string[];
  getFollowUpMessages?(): readonly string[];
  clearQueue?(): { steering: string[]; followUp: string[] };
}

export interface PiPromptOptions {
  expandPromptTemplates?: boolean;
  images?: unknown[];
  streamingBehavior?: "steer" | "followUp";
  source?: PiProviderSendSource;
  preflightResult?: (success: boolean) => void;
}

export interface PiPromptInput extends Omit<PiPromptOptions, "preflightResult"> {
  text: string;
}

export interface PiQueuedInput {
  text: string;
  images?: unknown[];
}

export interface PiProviderSnapshot {
  cwd: string;
  sessionFile: string | undefined;
  sessionId: string;
  sessionName?: string | undefined;
  messages: unknown[];
  streamingMessage?: unknown;
  isStreaming: boolean;
  isCompacting: boolean;
  model?: unknown;
  thinkingLevel?: string;
  steeringMode?: PiProviderQueueMode;
  followUpMode?: PiProviderQueueMode;
  steering: readonly string[];
  followUp: readonly string[];
  activeTools: readonly string[];
  tools: readonly unknown[];
  stats?: unknown;
  diagnostics: readonly AgentSessionRuntimeDiagnostic[];
  modelFallbackMessage?: string | undefined;
}

export interface PiProviderUiRequest {
  id: string;
  kind: PiProviderUiRequestKind;
  title: string;
  message?: string;
  placeholder?: string;
  value?: string;
  options?: string[];
}

export type PiProviderUiResponse =
  | { requestId: string; kind: "select"; value?: string; canceled?: boolean }
  | { requestId: string; kind: "confirm"; accepted: boolean; canceled?: boolean }
  | { requestId: string; kind: "input" | "editor"; value?: string; canceled?: boolean };

export type PiProviderEvent =
  | { type: "run.started"; occurredAt: number }
  | { type: "run.ended"; messages?: unknown[]; willRetry?: boolean; occurredAt: number }
  | { type: "run.failed"; errorMessage: string; occurredAt: number }
  | { type: "turn.started"; occurredAt: number }
  | { type: "turn.completed"; message?: unknown; toolResults?: unknown[]; occurredAt: number }
  | {
      type: "message.streaming";
      phase: "start" | "update" | "end";
      message?: unknown;
      deltaType?: string;
      errorMessage?: string;
      occurredAt: number;
    }
  | {
      type: "tool.updated";
      phase: "start" | "update" | "end";
      toolCallId: string;
      toolName: string;
      args?: unknown;
      content?: unknown;
      isError?: boolean;
      errorText?: string;
      occurredAt: number;
    }
  | { type: "queue.updated"; steering: readonly string[]; followUp: readonly string[]; occurredAt: number }
  | {
      type: "compaction.updated";
      phase: "start" | "end";
      reason?: string;
      aborted?: boolean;
      willRetry?: boolean;
      errorMessage?: string;
      result?: unknown;
      occurredAt: number;
    }
  | {
      type: "retry.updated";
      phase: "start" | "end";
      attempt?: number;
      maxAttempts?: number;
      delayMs?: number;
      success?: boolean;
      errorMessage?: string;
      occurredAt: number;
    }
  | { type: "session.changed"; snapshot: PiProviderSnapshot; occurredAt: number }
  | { type: "session.cancelled"; operation: "new" | "switch" | "fork" | "import"; occurredAt: number }
  | { type: "extension.error"; message: string; extensionPath?: string; event?: string; occurredAt: number }
  | { type: "extension.status"; statusKey: string; statusText?: string; occurredAt: number }
  | { type: "extension.notify"; message: string; notifyType: "info" | "warning" | "error"; occurredAt: number }
  | { type: "extension.widget"; widgetKey: string; widgetLines?: string[]; title?: string; occurredAt: number }
  | { type: "extension.ui.request"; request: PiProviderUiRequest; occurredAt: number }
  | { type: "extension.ui.resolved"; requestId: string; occurredAt: number }
  | { type: "provider.diagnostic"; level: "info" | "warning" | "error"; message: string; detail?: unknown; occurredAt: number };

export type PiProviderEventListener = (event: PiProviderEvent) => void;

export interface PiProviderSendResult {
  accepted: true;
}
