import { ProviderSelector } from "./ProviderSelector";
import type { Provider } from "../types";

interface HeaderProps {
    connectionStatus?: "disconnected" | "connecting" | "connected";
    onRetryConnection?: () => void;
    providers: Provider[];
    selectedProvider: Provider;
    onProviderChange: (provider: Provider) => void;
    isLoading?: boolean;
    onNewChat?: () => void;
}

/**
 * Header component with brand icon, provider selector, and action buttons
 */
export function Header({
    connectionStatus = "disconnected",
    onRetryConnection,
    providers,
    selectedProvider,
    onProviderChange,
    isLoading = false,
    onNewChat,
}: HeaderProps) {
    const statusLabels = {
        disconnected: "Disconnected - Click to retry",
        connecting: "Connecting...",
        connected: "Connected",
    };

    return (
        <header className="header">
            <div className="header-left">
                <h1 className="header-title">Zen Agent</h1>
                <ProviderSelector
                    providers={providers}
                    selectedProvider={selectedProvider}
                    onProviderChange={onProviderChange}
                    disabled={isLoading || connectionStatus !== "connected"}
                />
            </div>
            <div className="header-right">
                <button
                    className="header-icon-btn"
                    title="New chat"
                    onClick={onNewChat}
                >
                    ⊕
                </button>
                <button
                    className="header-icon-btn"
                    title="Menu"
                >
                    ⋮
                </button>
            </div>
        </header>
    );
}
