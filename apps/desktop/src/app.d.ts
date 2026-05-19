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

  interface Window {
    h3code?: {
      platform: string;
      metadata: {
        get: () => Promise<Metadata>;
      };
      settings: {
        get: () => Promise<SettingsState>;
        update: (settings: Settings) => Promise<SettingsState>;
      };
    };
  }
}

export {};
