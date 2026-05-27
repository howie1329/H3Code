export class AgentServerError extends Error {
    code;
    requestId;
    constructor(code, message, requestId) {
        super(message);
        this.code = code;
        this.requestId = requestId;
        this.name = "AgentServerError";
    }
}
export function errorMessage(error, requestId) {
    if (error instanceof AgentServerError) {
        return { type: "error", id: error.requestId ?? requestId, code: error.code, message: error.message };
    }
    return {
        type: "error",
        id: requestId,
        code: "internal_error",
        message: error instanceof Error ? error.message : String(error),
    };
}
//# sourceMappingURL=errors.js.map