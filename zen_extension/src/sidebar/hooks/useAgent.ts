import { useState, useCallback } from "react";
import { useBrowserRuntime } from "./useBrowserRuntime";
import type {
    Step,
    StepWithStatus,
    PlanResponse,
    StepResultResponse,
} from "../types";

/**
 * Hook that manages agent communication and plan execution state
 *
 * @returns Object with state and action functions
 *
 * @example
 * const { steps, isLoading, sendRequest, runNextStep } = useAgent();
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

    // Get the messaging function
    const { sendMessage } = useBrowserRuntime();

    /**
     * Send a goal to the agent and receive a plan
     */
    const sendRequest = useCallback(
        async (text: string): Promise<PlanResponse> => {
            setIsLoading(true);

            try {
                // Send request to background script
                const response = await sendMessage<PlanResponse>({
                    type: "AGENT_REQUEST",
                    text,
                });

                // Handle error response
                if (response.error) {
                    setSteps([]);
                    setCurrentIndex(0);
                    return response;
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

    return {
        // State
        steps,
        currentIndex,
        isLoading,
        hasStepsRemaining,
        allStepsComplete,

        // Actions
        sendRequest,
        runNextStep,
        reset,
    };
}
