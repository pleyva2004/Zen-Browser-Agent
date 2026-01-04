import type { ChatMessage as ChatMessageType } from "../types";

interface Props {
    message: ChatMessageType;
}

/**
 * Displays a single chat message with role indicator
 */
export function ChatMessage({ message }: Props) {
    const roleLabel = message.role === "user" ? "you" : "agent";

    return (
        <div className={`chat-message chat-message--${message.role}`}>
            <span className="chat-message__role">{roleLabel}:</span>
            <span className="chat-message__content">{message.content}</span>
        </div>
    );
}
