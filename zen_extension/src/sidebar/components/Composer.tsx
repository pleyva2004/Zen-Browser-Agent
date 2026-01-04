import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from "react";

interface Props {
    onSend: (text: string) => void;
    disabled: boolean;
}

/**
 * Input component for composing and sending goals
 */
export function Composer({ onSend, disabled }: Props) {
    const [value, setValue] = useState("");

    /**
     * Handle input change
     */
    const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
    }, []);

    /**
     * Send the current message
     */
    const handleSend = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;

        onSend(trimmed);
        setValue("");
    }, [value, disabled, onSend]);

    /**
     * Handle keyboard shortcuts
     */
    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            // Send on Enter (without Shift)
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    const canSend = value.trim().length > 0 && !disabled;

    return (
        <section className="composer">
            <textarea
                className="composer__input"
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="e.g. search nvidia ignite, click Sign in, scroll down"
                disabled={disabled}
                rows={2}
            />
            <button
                className="composer__button"
                onClick={handleSend}
                disabled={!canSend}
            >
                Send
            </button>
        </section>
    );
}
