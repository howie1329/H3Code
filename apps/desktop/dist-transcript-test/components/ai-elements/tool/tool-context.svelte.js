import { getContext, setContext } from "svelte";
import { watch } from "runed";
export class ToolClass {
    type = $state("");
    state = $state("input-streaming");
    input = $state(undefined);
    output = $state(undefined);
    errorText = $state(undefined);
    isOpen = $state(false);
    constructor(props) {
        this.type = props.type;
        this.state = props.state;
        this.input = props.input;
        this.output = props.output;
        this.errorText = props.errorText;
        this.isOpen = props.isOpen ?? false;
        // Watch for state changes and automatically handle tool opening/closing
        watch(() => this.state, (currentState, previousState) => {
            // Auto-open when tool starts processing
            if (currentState === "input-available" && !this.isOpen) {
                this.isOpen = true;
            }
            // Auto-close when tool completes with error (optional behavior)
            // Uncomment if you want this behavior:
            // if (currentState === 'output-error' && previousState !== 'output-error') {
            //   setTimeout(() => {
            //     this.isOpen = false;
            //   }, 3000);
            // }
        });
    }
    get statusBadge() {
        let labels = {
            "input-streaming": "Pending",
            "input-available": "Running",
            "output-available": "Completed",
            "output-error": "Error",
        };
        return {
            label: labels[this.state],
            variant: this.state === "output-error" ? "destructive" : "secondary",
        };
    }
    get hasOutput() {
        return !!(this.output || this.errorText);
    }
    get isComplete() {
        return this.state === "output-available" || this.state === "output-error";
    }
    get isRunning() {
        return this.state === "input-available";
    }
    get isPending() {
        return this.state === "input-streaming";
    }
    // Method to update tool state
    updateState(newState) {
        this.state = newState;
    }
    // Method to set output
    setOutput(output) {
        this.output = output;
        this.errorText = undefined;
        this.state = "output-available";
    }
    // Method to set error
    setError(errorText) {
        this.errorText = errorText;
        this.output = undefined;
        this.state = "output-error";
    }
    // Method to toggle open state
    toggle() {
        this.isOpen = !this.isOpen;
    }
    // Method to open tool
    open() {
        this.isOpen = true;
    }
    // Method to close tool
    close() {
        this.isOpen = false;
    }
}
let TOOL_CONTEXT_KEY = Symbol("tool");
export function setToolContext(toolInstance) {
    return setContext(TOOL_CONTEXT_KEY, toolInstance);
}
export function getToolContext() {
    let context = getContext(TOOL_CONTEXT_KEY);
    if (!context) {
        throw new Error("Tool components must be used within a Tool context provider");
    }
    return context;
}
//# sourceMappingURL=tool-context.svelte.js.map