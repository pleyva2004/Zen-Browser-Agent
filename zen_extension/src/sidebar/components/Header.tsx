interface HeaderProps {
    connectionStatus?: "disconnected" | "connecting" | "connected";
    onRetryConnection?: () => void;
}

/**
 * Header component displaying the app title, subtitle, and connection status
 */
export function Header({ connectionStatus = "disconnected", onRetryConnection }: HeaderProps) {
    const statusConfig = {
        disconnected: { color: "#ef4444", label: "Disconnected", icon: "●" },
        connecting: { color: "#f59e0b", label: "Connecting...", icon: "◐" },
        connected: { color: "#22c55e", label: "Connected", icon: "●" },
    };

    const status = statusConfig[connectionStatus];

    return (
        <header className="header">
            <div className="header-top">
                <h1 className="header-title">Zen Tab Agent</h1>
                <div
                    className="connection-status"
                    style={{ color: status.color }}
                    title={status.label}
                    onClick={connectionStatus === "disconnected" ? onRetryConnection : undefined}
                    role={connectionStatus === "disconnected" ? "button" : undefined}
                >
                    <span className={connectionStatus === "connecting" ? "pulse" : ""}>
                        {status.icon}
                    </span>
                    <span className="status-label">{status.label}</span>
                </div>
            </div>
            <p className="header-subtitle">Plan → Run next → Observe</p>
        </header>
    );
}
