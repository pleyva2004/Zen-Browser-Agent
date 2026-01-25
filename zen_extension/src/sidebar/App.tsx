import { useState, useCallback, useEffect, useRef } from "react";
import { useAgent } from "./hooks/useAgent";
import { Header } from "./components/Header";
import { Chat } from "./components/Chat";
import { PlanViewer } from "./components/PlanViewer";
import { Composer, type ComposerHandle } from "./components/Composer";
import { ActivityStatus } from "./components/ActivityStatus";
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
     * Handle approving the entire plan
     */
    const handleApprovePlan = useCallback(async () => {
        // Run all steps sequentially
        let result;
        do {
            result = await runNextStep();
            if (result.error) {
                addMessage("agent", `Error: ${result.error}`);
                break;
            }
            if (result.message) {
                addMessage("agent", result.message);
            }
        } while (!result.done);

        if (result?.done && !result?.error) {
            addMessage("agent", "Plan finished.");
        }
    }, [addMessage, runNextStep]);

    /**
     * Handle making changes to the plan
     */
    const composerRef = useRef<ComposerHandle>(null);
    const handleMakeChanges = useCallback(() => {
        // Focus the composer input for user to type changes
        if (composerRef.current) {
            composerRef.current.focus();
        }
    }, []);

    /**
     * Handle starting a new chat
     */
    const handleNewChat = useCallback(() => {
        setMessages([]);
    }, []);

    // Determine activity status text
    const getStatusText = (): string => {
        if (isTestingProvider) return "Testing provider...";
        if (isLoading) return "Thinking...";
        return "Working...";
    };

    return (
        <div className="app">
            <Header
                connectionStatus={connectionStatus}
                onRetryConnection={checkServerHealth}
                providers={providers}
                selectedProvider={selectedProvider}
                onProviderChange={handleProviderChange}
                isLoading={isLoading || isTestingProvider}
                onNewChat={handleNewChat}
            />
            <Chat messages={messages} />
            <ActivityStatus
                isLoading={isLoading || isTestingProvider}
                statusText={getStatusText()}
            />
            {steps.length > 0 && (
                <PlanViewer
                    steps={steps}
                    isLoading={isLoading}
                    onApprove={handleApprovePlan}
                    onMakeChanges={handleMakeChanges}
                />
            )}
            <Composer
                ref={composerRef}
                onSend={handleSend}
                disabled={isLoading || connectionStatus === "disconnected"}
                isLoading={isLoading}
            />
        </div>
    );
}
