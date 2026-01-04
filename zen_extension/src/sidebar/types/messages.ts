import type { Step } from "./plan";

// ============================================
// OUTGOING MESSAGES (Sidebar -> Background)
// ============================================

/**
 * Request to plan actions for a user goal
 */
export interface AgentRequestMessage {
    type: "AGENT_REQUEST";
    text: string;
}

/**
 * Request to execute the next step in the plan
 */
export interface RunNextStepMessage {
    type: "RUN_NEXT_STEP";
}

/**
 * Union of all outgoing message types
 */
export type OutgoingMessage = AgentRequestMessage | RunNextStepMessage;

// ============================================
// INCOMING RESPONSES (Background -> Sidebar)
// ============================================

/**
 * Response after requesting a plan
 */
export interface PlanResponse {
    /** Human-readable summary of the plan */
    summary: string;

    /** List of steps to execute */
    steps: Step[];

    /** Error message if planning failed */
    error?: string;
}

/**
 * Response after running a step
 */
export interface StepResultResponse {
    /** Index of the step that was executed */
    ranIndex?: number;

    /** Human-readable result message */
    message?: string;

    /** Whether all steps are complete */
    done: boolean;

    /** Error message if step failed */
    error?: string;
}
