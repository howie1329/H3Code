export type ProviderUiRequestKind = "select" | "confirm" | "input" | "editor";

export type ProviderUiRequest =
  | {
      id: string;
      kind: "select";
      title: string;
      message?: string;
      options: string[];
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
  | { requestId: string; kind: "select"; value?: string; canceled?: boolean }
  | { requestId: string; kind: "confirm"; accepted: boolean; canceled?: boolean }
  | { requestId: string; kind: "input" | "editor"; value?: string; canceled?: boolean };
