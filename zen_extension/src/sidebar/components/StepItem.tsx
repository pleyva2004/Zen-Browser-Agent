import type { StepWithStatus } from "../types";

interface Props {
    step: StepWithStatus;
    index: number;
}

/**
 * Get status icon for a step
 */
function getStatusIcon(status: StepWithStatus["status"]): string {
    switch (status) {
        case "pending":
            return "○";
        case "running":
            return "●";
        case "completed":
            return "✓";
        case "failed":
            return "✗";
    }
}

/**
 * Format step details for display
 */
function formatStepDetails(step: StepWithStatus): string {
    switch (step.tool) {
        case "CLICK":
            return `CLICK ${step.selector ? `(${step.selector})` : ""}`;
        case "TYPE":
            return `TYPE "${step.text?.slice(0, 30) ?? ""}"${(step.text?.length ?? 0) > 30 ? "..." : ""
                }`;
        case "SCROLL":
            return `SCROLL (${step.deltaY ?? 0}px)`;
        case "NAVIGATE":
            return `NAVIGATE ${step.url ?? ""}`;
        default:
            return step.tool;
    }
}

/**
 * Displays a single step with status indicator
 */
export function StepItem({ step, index }: Props) {
    const icon = getStatusIcon(step.status);
    const details = formatStepDetails(step);

    return (
        <li className={`step-item step-item--${step.status}`}>
            <span className="step-item__icon">{icon}</span>
            <span className="step-item__number">{index + 1}.</span>
            <span className="step-item__details">{details}</span>
            {step.note && <span className="step-item__note"> — {step.note}</span>}
        </li>
    );
}
