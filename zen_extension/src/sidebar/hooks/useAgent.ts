import { useState, useCallback, useEffect } from "react";
import { useBrowserRuntime } from "./useBrowserRuntime";
import type {
    Step,
    StepWithStatus,
    PlanResponse,
    StepResultResponse,
    Provider,
} from "../types";

// Connection status type
type ConnectionStatus = "disconnected" | "connecting" | "connected";

// Health check response
interface HealthCheckResponse {
    healthy: boolean;
    version?: string;
    error?: string;
}

// Providers response
interface ProvidersResponse {
    providers: string[];
    default: string;
    error?: string;
}

/**
 * Hook that manages agent communication and plan execution state
 *
 * @returns Object with state and action functions
 *
 * @example
 * const { steps, isLoading, sendRequest, runNextStep, connectionStatus } = useAgent();
 *
 * // Check connection status
 * if (connectionStatus === "disconnected") {
 *   await checkServerHealth();
 * }
 *
 * // Send a request
 * const response = await sendRequest("search for cats");
 *
 * // Run next step
 * const result = await runNextStep();
 */
export function useAgent() {
    // Current plan steps with execution status
    const [steps, setSteps] = useState<StepWithStatus[]>([]);

    // Index of the next step to execute
    const [currentIndex, setCurrentIndex] = useState(0);

    // Loading state for async operations
    const [isLoading, setIsLoading] = useState(false);

    // Connection status - start as "connecting" to show we're checking on mount
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

    // Get the messaging function
    const { sendMessage } = useBrowserRuntime();

    /**
     * Check if the server is healthy
     */
    const checkServerHealth = useCallback(async (): Promise<boolean> => {
        try {
            console.log("[useAgent] Starting health check...");
            setConnectionStatus("connecting");

            const response = await sendMessage<HealthCheckResponse>({
                type: "CHECK_SERVER_HEALTH",
            });

            console.log("[useAgent] Health check response:", response);

            if (response && response.healthy) {
                console.log("[useAgent] Server is healthy, version:", response.version);
                setConnectionStatus("connected");
                return true;
            } else {
                const errorMsg = response?.error || "Unknown error";
                console.warn("[useAgent] Server health check failed:", errorMsg);
                setConnectionStatus("disconnected");
                return false;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("[useAgent] Health check error:", errorMessage, error);
            setConnectionStatus("disconnected");
            return false;
        }
    }, [sendMessage]);

    /**
     * Fetch available providers from the server
     */
    const fetchProviders = useCallback(async (): Promise<ProvidersResponse> => {
        try {
            console.log("[useAgent] Fetching providers...");
            const response = await sendMessage<ProvidersResponse>({
                type: "GET_PROVIDERS",
            });
            console.log("[useAgent] Providers response:", response);
            return response;
        } catch (error) {
            console.error("[useAgent] Failed to fetch providers:", error);
            return {
                providers: ["rule_based"],
                default: "rule_based",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }, [sendMessage]);

    /**
     * Test a specific provider with a simple prompt
     */
    const testProvider = useCallback(async (provider: Provider): Promise<{
        success: boolean;
        provider: string;
        error?: string;
    }> => {
        try {
            console.log("[useAgent] Testing provider:", provider);
            const response = await sendMessage<{
                success: boolean;
                provider: string;
                error?: string;
            }>({
                type: "TEST_PROVIDER",
                provider,
            });
            console.log("[useAgent] Provider test result:", response);
            return response;
        } catch (error) {
            console.error("[useAgent] Provider test failed:", error);
            return {
                success: false,
                provider,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }, [sendMessage]);

    /**
     * Check server health on mount and periodically
     */
    useEffect(() => {
        console.log("[useAgent] Component mounted, running initial health check...");

        // Initial health check - run immediately on mount
        checkServerHealth();

        // Periodic health check every 30 seconds
        const interval = setInterval(() => {
            console.log("[useAgent] Running periodic health check...");
            checkServerHealth();
        }, 30000);

        return () => {
            console.log("[useAgent] Component unmounting, clearing health check interval");
            clearInterval(interval);
        };
    }, [checkServerHealth]);

    /**
     * Send a goal to the agent and receive a plan
     */
    const sendRequest = useCallback(
        async (text: string, provider?: Provider): Promise<PlanResponse> => {
            setIsLoading(true);
            setConnectionStatus("connecting");

            try {
                // Send request to background script with optional provider
                const response = await sendMessage<PlanResponse>({
                    type: "AGENT_REQUEST",
                    text,
                    provider,
                });

                // Handle error response
                if (response.error) {
                    setSteps([]);
                    setCurrentIndex(0);
                    // Check if it's a connection error
                    if (response.error.includes("Cannot connect") ||
                        response.error.includes("server")) {
                        setConnectionStatus("disconnected");
                    }
                    return response;
                }

                // Update connection status from response
                if ((response as any).connectionStatus) {
                    setConnectionStatus((response as any).connectionStatus);
                } else {
                    setConnectionStatus("connected");
                }

                // Transform steps to include status
                const stepsWithStatus: StepWithStatus[] = (response.steps ?? []).map(
                    (step: Step) => ({
                        ...step,
                        status: "pending" as const,
                    })
                );

                // Update state
                setSteps(stepsWithStatus);
                setCurrentIndex(0);

                return response;
            } catch (error) {
                // Return error response
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                setConnectionStatus("disconnected");
                return {
                    summary: "",
                    steps: [],
                    error: errorMessage,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [sendMessage]
    );

    /**
     * Execute the next step in the plan
     */
    const runNextStep = useCallback(async (): Promise<StepResultResponse> => {
        // Check if there are steps to run
        if (currentIndex >= steps.length) {
            return { done: true, message: "No steps left." };
        }

        setIsLoading(true);

        // Mark current step as running
        setSteps((prev) =>
            prev.map((step, i) =>
                i === currentIndex ? { ...step, status: "running" } : step
            )
        );

        try {
            // Send run request to background
            const result = await sendMessage<StepResultResponse>({
                type: "RUN_NEXT_STEP",
            });

            // Update step status based on result
            if (typeof result.ranIndex === "number") {
                setSteps((prev) =>
                    prev.map((step, i) =>
                        i === result.ranIndex
                            ? { ...step, status: result.error ? "failed" : "completed" }
                            : step
                    )
                );
                setCurrentIndex((prev) => prev + 1);
            }

            return result;
        } catch (error) {
            // Mark step as failed
            setSteps((prev) =>
                prev.map((step, i) =>
                    i === currentIndex ? { ...step, status: "failed" } : step
                )
            );

            const errorMessage =
                error instanceof Error ? error.message : String(error);
            return {
                done: false,
                error: errorMessage,
            };
        } finally {
            setIsLoading(false);
        }
    }, [currentIndex, steps.length, sendMessage]);

    /**
     * Reset the agent state
     */
    const reset = useCallback(() => {
        setSteps([]);
        setCurrentIndex(0);
        setIsLoading(false);
    }, []);

    // Computed values
    const hasStepsRemaining = currentIndex < steps.length;
    const allStepsComplete =
        steps.length > 0 && steps.every((s) => s.status === "completed");
    const isConnected = connectionStatus === "connected";

    return {
        // State
        steps,
        currentIndex,
        isLoading,
        hasStepsRemaining,
        allStepsComplete,
        connectionStatus,
        isConnected,

        // Actions
        sendRequest,
        runNextStep,
        reset,
        checkServerHealth,
        fetchProviders,
        testProvider,
    };
}
