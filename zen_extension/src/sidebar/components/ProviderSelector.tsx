import { useState, useRef, useEffect, useCallback } from "react";
import type { Provider } from "../types";
import { PROVIDER_LABELS } from "../types";

interface ProviderSelectorProps {
    providers: Provider[];
    selectedProvider: Provider;
    onProviderChange: (provider: Provider) => void;
    disabled?: boolean;
}

/**
 * Dropdown component for selecting the LLM provider
 */
export function ProviderSelector({
    providers,
    selectedProvider,
    onProviderChange,
    disabled = false,
}: ProviderSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            if (disabled) return;

            switch (event.key) {
                case "Escape":
                    setIsOpen(false);
                    break;
                case "Enter":
                case " ":
                    if (!isOpen) {
                        event.preventDefault();
                        setIsOpen(true);
                    }
                    break;
                case "ArrowDown":
                    event.preventDefault();
                    if (!isOpen) {
                        setIsOpen(true);
                    } else {
                        const currentIndex = providers.indexOf(selectedProvider);
                        const nextIndex = (currentIndex + 1) % providers.length;
                        onProviderChange(providers[nextIndex]);
                    }
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    if (isOpen) {
                        const currentIndex = providers.indexOf(selectedProvider);
                        const prevIndex = currentIndex === 0 ? providers.length - 1 : currentIndex - 1;
                        onProviderChange(providers[prevIndex]);
                    }
                    break;
            }
        },
        [disabled, isOpen, providers, selectedProvider, onProviderChange]
    );

    const handleSelect = (provider: Provider) => {
        onProviderChange(provider);
        setIsOpen(false);
    };

    const toggleDropdown = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    return (
        <div
            className={`provider-selector ${disabled ? "provider-selector--disabled" : ""}`}
            ref={containerRef}
            onKeyDown={handleKeyDown}
        >
            <button
                className="provider-selector__trigger"
                onClick={toggleDropdown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                type="button"
            >
                <span className="provider-selector__label">
                    {PROVIDER_LABELS[selectedProvider] || selectedProvider}
                </span>
                <span className={`provider-selector__chevron ${isOpen ? "provider-selector__chevron--open" : ""} ${disabled ? "pulse" : ""}`}>
                    {disabled ? "◐" : "▾"}
                </span>
            </button>

            {isOpen && (
                <ul className="provider-selector__menu" role="listbox">
                    {providers.map((provider) => (
                        <li
                            key={provider}
                            className={`provider-selector__option ${
                                provider === selectedProvider ? "provider-selector__option--selected" : ""
                            }`}
                            onClick={() => handleSelect(provider)}
                            role="option"
                            aria-selected={provider === selectedProvider}
                        >
                            <span className="provider-selector__option-check">
                                {provider === selectedProvider ? "✓" : ""}
                            </span>
                            <span className="provider-selector__option-label">
                                {PROVIDER_LABELS[provider] || provider}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
