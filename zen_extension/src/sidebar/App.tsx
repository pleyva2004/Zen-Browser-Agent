import { useState, useCallback } from "react";
import { useAgent } from "./hooks/useAgent";
import { Header } from "./components/Header";
import { Chat } from "./components/Chat";
import { PlanViewer } from "./components/PlanViewer";
import { Composer } from "./components/Composer";
import type { ChatMessage } from "./types";

/**
 * Generate a unique ID for messages
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Root application component
 */
export function App() {
    // Chat message history
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Agent hook for communication
    const {
        steps,
        isLoading,
        sendRequest,
        runNextStep,
        connectionStatus,
        checkServerHealth
    } = useAgent();

    /**
     * Add a message to the chat
     */
    const addMessage = useCallback((role: ChatMessage["role"], content: string) => {
        const message: ChatMessage = {
            id: generateId(),
            role,
            content,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, message]);
    }, []);

    /**
     * Handle sending a user goal
     */
    const handleSend = useCallback(
        async (text: string) => {
            // Add user message
            addMessage("user", text);

            // Send to agent
            const response = await sendRequest(text);

            // Add agent response
            if (response.error) {
                addMessage("agent", `Error: ${response.error}`);
            } else {
                addMessage("agent", response.summary || "Plan ready.");
            }
        },
        [addMessage, sendRequest]
    );

    /**
     * Handle running the next step
     */
    const handleRunNext = useCallback(async () => {
        const result = await runNextStep();

        // Add result message
        if (result.error) {
            addMessage("agent", `Error: ${result.error}`);
        } else if (result.message) {
            addMessage("agent", result.message);
        }

        // Add completion message
        if (result.done && !result.error) {
            addMessage("agent", "Plan finished.");
        }
    }, [addMessage, runNextStep]);

    return (
        <div className="app">
            <Header
                connectionStatus={connectionStatus}
                onRetryConnection={checkServerHealth}
            />
            <Chat messages={messages} />
            <PlanViewer
                steps={steps}
                onRunNext={handleRunNext}
                isLoading={isLoading}
            />
            <Composer
                onSend={handleSend}
                disabled={isLoading || connectionStatus === "disconnected"}
            />
        </div>
    );
}
