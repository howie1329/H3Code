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
  };

  type Settings = {
    piExecutablePath: string;
  };

  type Metadata = {
    schemaVersion: 1;
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

  type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
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
      sessions: {
        list: (input: { repoId: string }) => Promise<IpcResult<Session[]>>;
        create: (input: { repoId: string; title?: string }) => Promise<IpcResult<Session>>;
        getMessages: (input: { sessionId: string }) => Promise<IpcResult<Message[]>>;
        sendMessage: (input: { sessionId: string; prompt: string }) => Promise<IpcResult<never>>;
      };
      settings: {
        get: () => Promise<SettingsState>;
        update: (settings: Settings) => Promise<SettingsState>;
      };
      files: {
        resolveMentions: (input: { repoId: string; prompt: string }) => Promise<IpcResult<ResolvedMentions>>;
      };
      pi: {
        stopSession: (input: { sessionId: string }) => Promise<IpcResult<never>>;
      };
    };
  }
}

export {};
