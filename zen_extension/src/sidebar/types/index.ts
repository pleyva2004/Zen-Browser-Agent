// Re-export all types from a single entry point
export * from "./plan";
export * from "./messages";

/**
 * Available LLM providers
 */
export type Provider = "rule_based" | "anthropic" | "openai" | "gemini" | "local";

/**
 * Human-readable labels for providers
 */
export const PROVIDER_LABELS: Record<Provider, string> = {
    rule_based: "Rule-Based",
    anthropic: "Claude",
    openai: "GPT-4",
    gemini: "Gemini",
    local: "Local LLM",
};

/**
 * A single message in the chat history
 */
export interface ChatMessage {
    /** Unique identifier for React keys */
    id: string;

    /** Who sent the message */
    role: "user" | "agent";

    /** Message content */
    content: string;

    /** When the message was created */
    timestamp: Date;
}
