import { useState, useCallback, useEffect } from "react";
import { useAgent } from "./hooks/useAgent";
import { Header } from "./components/Header";
import { Chat } from "./components/Chat";
import { PlanViewer } from "./components/PlanViewer";
import { Composer } from "./components/Composer";
import type { ChatMessage, Provider } from "./types";

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

    // Provider state
    const [selectedProvider, setSelectedProvider] = useState<Provider>("rule_based");
    const [providers, setProviders] = useState<Provider[]>(["rule_based"]);
    const [isTestingProvider, setIsTestingProvider] = useState(false);

    // Agent hook for communication
    const {
        steps,
        isLoading,
        sendRequest,
        runNextStep,
        connectionStatus,
        checkServerHealth,
        fetchProviders,
        testProvider,
    } = useAgent();

    // Fetch providers when connected
    useEffect(() => {
        if (connectionStatus === "connected") {
            fetchProviders().then((response) => {
                if (response.providers && response.providers.length > 0) {
                    setProviders(response.providers as Provider[]);
                }
            });
        }
    }, [connectionStatus, fetchProviders]);

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
     * Handle provider selection change - test provider before switching
     */
    const handleProviderChange = useCallback(
        async (newProvider: Provider) => {
            // Skip test for rule_based (always works)
            if (newProvider === "rule_based") {
                setSelectedProvider(newProvider);
                return;
            }

            // Test the provider
            setIsTestingProvider(true);
            const result = await testProvider(newProvider);
            setIsTestingProvider(false);

            if (result.success) {
                setSelectedProvider(newProvider);
            } else {
                // Provider test failed - show error and keep current provider
                addMessage("agent", `Provider "${newProvider}" is not available: ${result.error || "Unknown error"}`);
            }
        },
        [testProvider, addMessage]
    );

    /**
     * Handle sending a user goal
     */
    const handleSend = useCallback(
        async (text: string) => {
            // Add user message
            addMessage("user", text);

            // Send to agent with selected provider
            const response = await sendRequest(text, selectedProvider);

            // Add agent response
            if (response.error) {
                addMessage("agent", `Error: ${response.error}`);
            } else {
                addMessage("agent", response.summary || "Plan ready.");
            }
        },
        [addMessage, sendRequest, selectedProvider]
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
                providers={providers}
                selectedProvider={selectedProvider}
                onProviderChange={handleProviderChange}
                isLoading={isLoading || isTestingProvider}
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
