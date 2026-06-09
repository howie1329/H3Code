import type { CustomOverlayOptions } from "./types.js";

export type CustomUiMatch = {
  componentId: string;
  payload: unknown;
  overlay?: CustomOverlayOptions;
};

const ASK_USER_COMPONENT_ID = "rpiv:ask-user:prompt";

export class CustomUiCorrelation {
  #extensionStash: CustomUiMatch[] = [];
  #toolStash: CustomUiMatch[] = [];

  onExtensionEvent(channel: string, data: unknown) {
    if (channel !== ASK_USER_COMPONENT_ID) {
      return;
    }

    this.#extensionStash.push({
      componentId: ASK_USER_COMPONENT_ID,
      payload: data,
      overlay: { anchor: "bottom-center", width: "100%", maxHeight: "100%" },
    });
  }

  onToolExecutionStart(toolName: string, args: unknown) {
    if (toolName !== "ask_user_question") {
      return;
    }

    const record = args as { questions?: unknown };
    if (!Array.isArray(record.questions)) {
      return;
    }

    this.#toolStash.push({
      componentId: ASK_USER_COMPONENT_ID,
      payload: { questions: record.questions },
      overlay: { anchor: "bottom-center", width: "100%", maxHeight: "100%" },
    });
  }

  consumeForCustom(): CustomUiMatch | undefined {
    return this.#extensionStash.shift() ?? this.#toolStash.shift();
  }

  clear() {
    this.#extensionStash = [];
    this.#toolStash = [];
  }
}
