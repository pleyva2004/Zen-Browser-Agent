import type { ChatMessage as ChatMessageType } from "../types";

interface Props {
    message: ChatMessageType;
}

/**
 * Displays a single chat message without role labels
 */
export function ChatMessage({ message }: Props) {
    return (
        <div className={`chat-message chat-message--${message.role}`}>
            <span className="chat-message__content">{message.content}</span>
        </div>
    );
}
