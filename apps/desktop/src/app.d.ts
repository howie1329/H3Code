declare global {
  type PiExecutableValidationStatus =
    | 'missing'
    | 'nonexistent'
    | 'non-file'
    | 'non-executable'
    | 'valid';

  type Repo = {
    id: string;
    name: string;
    path: string;
    addedAt: string;
    lastOpenedAt?: string;
    selectedSessionPath?: string;
  };

  type Session = {
    id: string;
    repoId: string;
    harness: 'pi';
    harnessSessionPath: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    status: 'idle' | 'running' | 'error';
    isDraft?: boolean;
  };

  type Settings = {
    piExecutablePath: string;
  };

  type Metadata = {
    schemaVersion: 2;
    selectedRepoId?: string;
    repos: Repo[];
    settings: Settings;
  };

  type SettingsState = {
    settings: Settings;
    validation: {
      status: PiExecutableValidationStatus;
      message: string;
    };
  };

  type IpcResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

  type PiDetectionSource = 'path' | 'nvm' | 'local-bin' | 'pnpm' | 'homebrew' | 'system';

  type PiDetectionResult = {
    path: string;
    source: PiDetectionSource;
  };

  type PickRepositoryDirectoryResult = {
    path: string;
  } | null;

  type TranscriptMessage = {
    id: string;
    kind: 'user' | 'assistant' | 'tool' | 'system' | 'error' | 'diagnostic';
    title?: string;
    content: string;
    createdAt: string;
  };

  type TranscriptMessagesResult = {
    messages: TranscriptMessage[];
    meta: {
      sessionId: string;
      sessionPath: string;
      rawMessageCount: number;
      normalizedMessageCount: number;
      source?: 'jsonl' | 'rpc' | 'diagnostic';
      timings?: Record<string, number>;
    };
  };

  type TranscriptEvent = {
    id: string;
    sessionId: string;
    createdAt: string;
    kind: TranscriptMessage['kind'];
    blockId: string;
    mode: 'append' | 'replace' | 'final';
    content: string;
    title?: string;
    toolCallId?: string;
    toolName?: string;
    stream?: 'stdout' | 'stderr';
    rawPayload?: unknown;
  };

  type TranscriptBlock = {
    id: string;
    kind: TranscriptEvent['kind'];
    title?: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    isFinal: boolean;
  };

  interface Window {
    h3code?: {
      platform: string;
      metadata: {
        get: () => Promise<Metadata>;
      };
      repos: {
        list: () => Promise<IpcResult<Repo[]>>;
        add: (input: { path: string }) => Promise<IpcResult<Repo>>;
        select: (input: { repoId: string }) => Promise<IpcResult<Repo>>;
      };
      dialog: {
        pickRepositoryDirectory: () => Promise<IpcResult<PickRepositoryDirectoryResult>>;
      };
      sessions: {
        list: (input: { repoId: string }) => Promise<IpcResult<Session[]>>;
        createDraft: (input: { repoId: string }) => Promise<IpcResult<Session>>;
        select: (input: { repoId: string; sessionId: string; sessionPath?: string }) => Promise<IpcResult<Session>>;
        getLocalMessages: (input: { repoId: string; sessionId: string; sessionPath?: string }) => Promise<IpcResult<TranscriptMessagesResult>>;
        getMessages: (input: { repoId: string; sessionId: string; sessionPath?: string }) => Promise<IpcResult<TranscriptMessagesResult>>;
        sendMessage: (input: {
          repoId: string;
          sessionId: string;
          sessionPath?: string;
          prompt: string;
        }) => Promise<IpcResult<{ accepted: boolean; sessionPath?: string }>>;
        onTranscriptEvent: (callback: (event: TranscriptEvent) => void) => () => void;
        onSessionUpdated: (callback: (session: Session) => void) => () => void;
        onMessagesUpdated: (callback: (payload: TranscriptMessagesResult) => void) => () => void;
      };
      settings: {
        get: () => Promise<SettingsState>;
        update: (settings: Settings) => Promise<SettingsState>;
        detectPiExecutable: () => Promise<IpcResult<PiDetectionResult>>;
      };
      pi: {
        stop: () => Promise<IpcResult<{ stopped: boolean }>>;
      };
    };
  }
}

export {};
