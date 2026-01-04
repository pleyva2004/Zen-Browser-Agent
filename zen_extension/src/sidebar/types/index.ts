// Re-export all types from a single entry point
export * from "./plan";
export * from "./messages";

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
