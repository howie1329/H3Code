export class PiExtensionUiBridge {
    emit;
    #pending = new Map();
    #nextRequestId = 1;
    constructor(emit) {
        this.emit = emit;
    }
    createContext() {
        const bridge = this;
        return {
            select(title, options, opts) {
                void opts;
                return bridge.request({
                    kind: "select",
                    title,
                    options,
                });
            },
            confirm(title, message, opts) {
                void opts;
                return bridge.request({
                    kind: "confirm",
                    title,
                    message,
                });
            },
            input(title, placeholder, opts) {
                void opts;
                return bridge.request({
                    kind: "input",
                    title,
                    placeholder,
                });
            },
            editor(title, prefill) {
                return bridge.request({
                    kind: "editor",
                    title,
                    value: prefill,
                });
            },
            notify(message, type = "info") {
                bridge.emit({
                    type: "extension.notify",
                    message,
                    notifyType: type,
                    occurredAt: Date.now(),
                });
            },
            onTerminalInput() {
                return () => { };
            },
            setStatus(key, text) {
                bridge.emit({
                    type: "extension.status",
                    statusKey: key,
                    statusText: text,
                    occurredAt: Date.now(),
                });
            },
            setWorkingMessage(message) {
                bridge.emit({
                    type: "extension.status",
                    statusKey: "__working_message__",
                    statusText: message,
                    occurredAt: Date.now(),
                });
            },
            setWorkingVisible(visible) {
                bridge.emit({
                    type: "extension.status",
                    statusKey: "__working_visible__",
                    statusText: String(visible),
                    occurredAt: Date.now(),
                });
            },
            setWorkingIndicator() { },
            setHiddenThinkingLabel(label) {
                bridge.emit({
                    type: "extension.status",
                    statusKey: "__hidden_thinking_label__",
                    statusText: label,
                    occurredAt: Date.now(),
                });
            },
            setWidget(key, content) {
                bridge.emit({
                    type: "extension.widget",
                    widgetKey: key,
                    widgetLines: Array.isArray(content) ? content : undefined,
                    occurredAt: Date.now(),
                });
            },
            setFooter() { },
            setHeader() { },
            setTitle(title) {
                bridge.emit({
                    type: "extension.widget",
                    widgetKey: "__title__",
                    title,
                    occurredAt: Date.now(),
                });
            },
            custom() {
                throw new Error("Custom extension UI components are not supported by the H3Code Pi provider.");
            },
            pasteToEditor() { },
            setEditorText() { },
            getEditorText() {
                return "";
            },
            addAutocompleteProvider() { },
            setEditorComponent() { },
            getEditorComponent() {
                return undefined;
            },
            get theme() {
                return {};
            },
            getAllThemes() {
                return [];
            },
            getTheme() {
                return undefined;
            },
            setTheme() {
                return { success: false, error: "Themes are not supported by the H3Code Pi provider." };
            },
            getToolsExpanded() {
                return false;
            },
            setToolsExpanded() { },
        };
    }
    respond(response) {
        const pending = this.#pending.get(response.requestId);
        if (!pending) {
            throw new Error(`Unknown extension UI request: ${response.requestId}`);
        }
        this.#pending.delete(response.requestId);
        pending.resolve(responseToValue(response));
        this.emit({ type: "extension.ui.resolved", requestId: response.requestId, occurredAt: Date.now() });
    }
    rejectAll(error) {
        for (const [requestId, pending] of this.#pending) {
            this.#pending.delete(requestId);
            pending.resolve(undefined);
            this.emit({
                type: "provider.diagnostic",
                level: "warning",
                message: error.message,
                detail: pending.request,
                occurredAt: Date.now(),
            });
        }
    }
    request(request) {
        const id = `pi-ui-${this.#nextRequestId++}`;
        const fullRequest = { ...request, id };
        return new Promise((resolve) => {
            this.#pending.set(id, { request: fullRequest, resolve: resolve });
            this.emit({ type: "extension.ui.request", request: fullRequest, occurredAt: Date.now() });
        });
    }
}
function responseToValue(response) {
    if (response.canceled) {
        return undefined;
    }
    switch (response.kind) {
        case "select":
            return response.value;
        case "confirm":
            return response.accepted;
        case "input":
        case "editor":
            return response.value;
        default:
            return undefined;
    }
}
//# sourceMappingURL=extension-ui.js.map