import type { StepWithStatus } from "../types";
import { StepItem } from "./StepItem";

interface Props {
    steps: StepWithStatus[];
    onRunNext: () => void;
    isLoading: boolean;
}

/**
 * Displays the execution plan with steps and run button
 */
export function PlanViewer({ steps, onRunNext, isLoading }: Props) {
    // Determine button state
    const hasSteps = steps.length > 0;
    const allComplete = steps.every((s) => s.status === "completed");
    const hasFailed = steps.some((s) => s.status === "failed");
    const canRun = hasSteps && !allComplete && !hasFailed && !isLoading;

    // Determine button text
    const getButtonText = (): string => {
        if (isLoading) return "Running...";
        if (allComplete) return "Complete";
        if (hasFailed) return "Failed";
        return "Run next";
    };

    return (
        <section className="plan-viewer">
            <div className="plan-viewer__header">
                <span className="plan-viewer__title">Plan</span>
                <button
                    className="plan-viewer__button"
                    onClick={onRunNext}
                    disabled={!canRun}
                >
                    {getButtonText()}
                </button>
            </div>

            {hasSteps ? (
                <ol className="plan-viewer__steps">
                    {steps.map((step, index) => (
                        <StepItem key={index} step={step} index={index} />
                    ))}
                </ol>
            ) : (
                <div className="plan-viewer__empty">No plan yet.</div>
            )}
        </section>
    );
}
