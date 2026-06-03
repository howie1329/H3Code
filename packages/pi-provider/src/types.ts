import type {
  AgentSessionRuntimeDiagnostic,
  AuthStorage,
  ModelRegistry,
  ResourceLoader,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { SessionDomainEvent } from "@h3code/agent-core";

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

export interface PiRuntimeServices {
  modelRegistry?: import("@earendil-works/pi-coding-agent").ModelRegistry;
  resourceLoader?: import("@earendil-works/pi-coding-agent").ResourceLoader;
}

export interface PiRuntimeLike {
  readonly cwd: string;
  readonly session: PiSessionLike;
  readonly services?: PiRuntimeServices;
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
  setSteeringMode?(mode: PiProviderQueueMode): void;
  setFollowUpMode?(mode: PiProviderQueueMode): void;
  setAutoCompactionEnabled?(enabled: boolean): void;
  getAutoCompactionEnabled?(): boolean;
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
  autoCompactionEnabled?: boolean;
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

type CoreCompatiblePiProviderEvent = Exclude<
  SessionDomainEvent,
  Extract<SessionDomainEvent, { type: "session.changed" | "extension.ui.request" }>
>;

export type PiProviderEvent =
  | CoreCompatiblePiProviderEvent
  | { type: "session.changed"; snapshot: PiProviderSnapshot; occurredAt: number }
  | { type: "extension.ui.request"; request: PiProviderUiRequest; occurredAt: number };

export type PiProviderEventListener = (event: PiProviderEvent) => void;

export interface PiProviderSendResult {
  accepted: true;
}
