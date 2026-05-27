export type ProviderUiRequestKind = "select" | "confirm" | "input" | "editor";

export interface ProviderUiOption {
  id: string;
  label: string;
  description?: string;
}

export type ProviderUiRequest =
  | {
      id: string;
      kind: "select";
      title: string;
      message?: string;
      options: ProviderUiOption[];
    }
  | {
      id: string;
      kind: "confirm";
      title: string;
      message?: string;
    }
  | {
      id: string;
      kind: "input";
      title: string;
      message?: string;
      placeholder?: string;
      value?: string;
    }
  | {
      id: string;
      kind: "editor";
      title: string;
      message?: string;
      value?: string;
      language?: string;
    };

export type ProviderUiResponse =
  | { requestId: string; kind: "select"; optionId: string }
  | { requestId: string; kind: "confirm"; accepted: boolean }
  | { requestId: string; kind: "input" | "editor"; value: string }
  | { requestId: string; kind: ProviderUiRequestKind; canceled: true };
