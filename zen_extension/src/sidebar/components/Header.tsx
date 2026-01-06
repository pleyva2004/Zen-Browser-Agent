import { ProviderSelector } from "./ProviderSelector";
import type { Provider } from "../types";

interface HeaderProps {
    connectionStatus?: "disconnected" | "connecting" | "connected";
    onRetryConnection?: () => void;
    providers: Provider[];
    selectedProvider: Provider;
    onProviderChange: (provider: Provider) => void;
    isLoading?: boolean;
}

/**
 * Header component displaying the app title, subtitle, connection status, and provider selector
 */
export function Header({
    connectionStatus = "disconnected",
    onRetryConnection,
    providers,
    selectedProvider,
    onProviderChange,
    isLoading = false,
}: HeaderProps) {
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
            <div className="header-controls">
                <p className="header-subtitle">Plan → Run next → Observe</p>
                <ProviderSelector
                    providers={providers}
                    selectedProvider={selectedProvider}
                    onProviderChange={onProviderChange}
                    disabled={isLoading || connectionStatus !== "connected"}
                />
            </div>
        </header>
    );
}
