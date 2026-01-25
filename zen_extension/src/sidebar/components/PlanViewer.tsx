import type { StepWithStatus } from "../types";
import { StepItem } from "./StepItem";

interface Props {
    steps: StepWithStatus[];
    isLoading: boolean;
    onApprove: () => void;
    onMakeChanges: () => void;
    currentUrl?: string;
}

/**
 * Displays the execution plan in card-style format with numbered steps
 */
export function PlanViewer({ steps, isLoading, onApprove, onMakeChanges, currentUrl }: Props) {
    const hasSteps = steps.length > 0;
    const allComplete = steps.every((s) => s.status === "completed");
    const hasFailed = steps.some((s) => s.status === "failed");
    const canApprove = hasSteps && !allComplete && !hasFailed;

    // Extract domain from current URL for sites section
    const getDomain = () => {
        if (!currentUrl) return "unknown site";
        try {
            const url = new URL(currentUrl);
            return url.hostname.replace(/^www\./, '');
        } catch (e) {
            return "unknown site";
        }
    };

    const domain = getDomain();

    return (
        <div className="plan-card">
            {/* Header */}
            <div className="plan-card__header">
                <span className="plan-card__header-icon">☰</span>
                <span>Zen Agent's plan</span>
            </div>

            {/* Sites Section */}
            <div className="plan-card__sites">
                <div className="plan-card__sites-label">Allow actions on these sites</div>
                <div className="plan-card__site-badge">
                    <span className="plan-card__site-icon">🌐</span>
                    <span>{domain}</span>
                </div>
            </div>

            {/* Approach Section */}
            <div className="plan-card__approach">
                <div className="plan-card__approach-label">Approach to follow</div>
                {hasSteps ? (
                    <ol className="plan-card__steps">
                        {steps.map((step, index) => (
                            <StepItem key={index} step={step} index={index} />
                        ))}
                    </ol>
                ) : (
                    <div className="plan-card__empty">No plan yet.</div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="plan-card__actions">
                <button
                    className="plan-card__btn plan-card__btn--primary"
                    onClick={onApprove}
                    disabled={!canApprove || isLoading}
                >
                    <span>Approve plan</span>
                    <span className="plan-card__btn-shortcut">↵</span>
                </button>
                <button
                    className="plan-card__btn"
                    onClick={onMakeChanges}
                    disabled={isLoading}
                >
                    <span>Make changes</span>
                    <span className="plan-card__btn-shortcut">⌘↵</span>
                </button>
            </div>

            {/* Disclaimer */}
            <div className="plan-card__disclaimer">
                Zen Agent will only use the sites listed. You'll be asked before accessing anything else.
            </div>
        </div>
    );
}
