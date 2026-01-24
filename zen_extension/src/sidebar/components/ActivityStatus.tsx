interface Props {
    isLoading: boolean;
    statusText?: string;
}

/**
 * Displays an activity spinner with status text when loading
 */
export function ActivityStatus({ isLoading, statusText }: Props) {
    if (!isLoading) return null;

    return (
        <div className="activity-status">
            <span className="activity-status__icon">❋</span>
            <span>{statusText || "Working..."}</span>
        </div>
    );
}
