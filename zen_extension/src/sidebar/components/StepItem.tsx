import type { StepWithStatus } from "../types";

interface Props {
    step: StepWithStatus;
    index: number;
}

/**
 * Get action icon based on tool type
 */
function getActionIcon(tool: string, status: StepWithStatus["status"]): string {
    // Show checkmark for completed steps
    if (status === "completed") return "✓";
    // Show X for failed steps
    if (status === "failed") return "✗";

    // Show tool-specific icon for pending/running
    switch (tool) {
        case "CLICK":
            return "⊙";
        case "TYPE":
            return "⌨";
        case "SCROLL":
            return "↕";
        case "NAVIGATE":
            return "→";
        default:
            return "●";
    }
}

/**
 * Format step details for display (human-readable)
 */
function formatStepDetails(step: StepWithStatus): string {
    switch (step.tool) {
        case "CLICK":
            return step.note || `Click ${step.selector || "element"}`;
        case "TYPE":
            const text = step.text?.slice(0, 30) ?? "";
            const ellipsis = (step.text?.length ?? 0) > 30 ? "..." : "";
            return `Type "${text}${ellipsis}"`;
        case "SCROLL":
            const direction = (step.deltaY ?? 0) > 0 ? "down" : "up";
            return `Scroll ${direction}`;
        case "NAVIGATE":
            return `Navigate to ${step.url ?? "page"}`;
        default:
            return step.tool;
    }
}

/**
 * Displays a single step in timeline format with action icon
 */
export function StepItem({ step }: Props) {
    const icon = getActionIcon(step.tool, step.status);
    const details = formatStepDetails(step);

    return (
        <li className={`step-item step-item--${step.status}`}>
            <span className="step-item__icon">{icon}</span>
            <div className="step-item__content">
                <span className="step-item__details">{details}</span>
                {step.note && step.tool !== "CLICK" && (
                    <span className="step-item__note">{step.note}</span>
                )}
            </div>
        </li>
    );
}
