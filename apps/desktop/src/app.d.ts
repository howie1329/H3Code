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
    selectedSessionId?: string;
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
    titleSource?: 'local' | 'pi' | 'user';
  };

  type Settings = {
    piExecutablePath: string;
  };

  type Metadata = {
    schemaVersion: 1;
    selectedRepoId?: string;
    repos: Repo[];
    sessions: Session[];
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

  type TranscriptEvent = {
    id: string;
    sessionId: string;
    createdAt: string;
    type:
      | 'user_message'
      | 'process_started'
      | 'rpc_response'
      | 'assistant_delta'
      | 'tool_execution_update'
      | 'extension_ui_request'
      | 'stderr'
      | 'process_exit'
      | 'rpc_event';
    content?: string;
    role?: 'user' | 'assistant' | 'system';
    stream?: 'stdout' | 'stderr';
    command?: string;
    success?: boolean;
    toolName?: string;
    exitCode?: number | null;
    signal?: string | null;
    payload?: unknown;
  };

  type ResolvedMentions = {
    prompt: string;
    mentions: Array<{ path: string; content: string }>;
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
        create: (input: { repoId: string; title?: string }) => Promise<IpcResult<Session>>;
        select: (input: { repoId: string; sessionId: string }) => Promise<IpcResult<Session>>;
        getMessages: (input: { sessionId: string }) => Promise<IpcResult<TranscriptEvent[]>>;
        updateTitle: (input: { sessionId: string; title: string }) => Promise<IpcResult<Session>>;
        sendMessage: (input: { sessionId: string; prompt: string }) => Promise<IpcResult<{ accepted: boolean }>>;
        onTranscriptEvent: (callback: (event: TranscriptEvent) => void) => () => void;
        onSessionUpdated: (callback: (session: Session) => void) => () => void;
      };
      settings: {
        get: () => Promise<SettingsState>;
        update: (settings: Settings) => Promise<SettingsState>;
        detectPiExecutable: () => Promise<IpcResult<PiDetectionResult>>;
      };
      files: {
        resolveMentions: (input: { repoId: string; prompt: string }) => Promise<IpcResult<ResolvedMentions>>;
      };
      pi: {
        stopSession: (input: { sessionId: string }) => Promise<IpcResult<{ stopped: boolean }>>;
      };
    };
  }
}

export {};
