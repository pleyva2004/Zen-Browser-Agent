import { useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "../types";
import { ChatMessage } from "./ChatMessage";

interface Props {
    messages: ChatMessageType[];
}

/**
 * Chat container that displays messages and auto-scrolls to bottom
 */
export function Chat({ messages }: Props) {
    // Ref to the bottom element for scrolling
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll when new messages arrive
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    return (
        <section className="chat">
            {messages.length === 0 ? (
                <div className="chat__empty">
                    Type a goal below to get started.
                </div>
            ) : (
                messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
            )}
            {/* Invisible element at bottom for scroll targeting */}
            <div ref={bottomRef} />
        </section>
    );
}
