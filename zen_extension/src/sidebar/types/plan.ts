/**
 * Available tool operations the agent can execute
 */
export type Tool = "CLICK" | "TYPE" | "SCROLL" | "NAVIGATE";

/**
 * A single step in an execution plan
 */
export interface Step {
    /** The tool/action to execute */
    tool: Tool;

    /** CSS selector for the target element (CLICK, TYPE) */
    selector?: string;

    /** Text to type (TYPE only) */
    text?: string;

    /** Scroll amount in pixels (SCROLL only) */
    deltaY?: number;

    /** URL to navigate to (NAVIGATE only) */
    url?: string;

    /** Human-readable explanation of this step */
    note?: string;
}

/**
 * Possible states for a step during execution
 */
export type StepStatus = "pending" | "running" | "completed" | "failed";

/**
 * Step with runtime status tracking
 */
export interface StepWithStatus extends Step {
    status: StepStatus;
}
