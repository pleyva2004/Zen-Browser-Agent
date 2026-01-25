import type { StepWithStatus } from "../types";

interface Props {
    step: StepWithStatus;
    index: number;
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
 * Displays a single step with numbered circle
 */
export function StepItem({ step, index }: Props) {
    const details = formatStepDetails(step);

    return (
        <li className={`plan-step plan-step--${step.status}`}>
            <span className="plan-step__number">{index + 1}</span>
            <span className="plan-step__text">{details}</span>
        </li>
    );
}
