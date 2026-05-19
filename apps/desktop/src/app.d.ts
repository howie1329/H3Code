declare global {
  type PiExecutableValidationStatus =
    | 'missing'
    | 'nonexistent'
    | 'non-file'
    | 'non-executable'
    | 'valid';

  type Settings = {
    piExecutablePath: string;
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
      settings: {
        get: () => Promise<SettingsState>;
        update: (settings: Settings) => Promise<SettingsState>;
      };
    };
  }
}

export {};
