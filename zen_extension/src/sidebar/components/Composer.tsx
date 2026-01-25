import { useState, useCallback, type KeyboardEvent, type ChangeEvent, forwardRef, useImperativeHandle, useRef } from "react";

interface Props {
    onSend: (text: string) => void;
    disabled: boolean;
    isLoading?: boolean;
    onStop?: () => void;
}

export interface ComposerHandle {
    focus: () => void;
}

export const Composer = forwardRef<ComposerHandle, Props>(({ onSend, disabled, isLoading = false, onStop }, ref) => {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
        focus: () => {
            if (textareaRef.current) {
                textareaRef.current.focus();
            }
        }
    }));

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
            <div className="composer__input-wrapper">
                 <textarea
                     ref={textareaRef}
                     className="composer__input"
                     value={value}
                     onChange={handleChange}
                     onKeyDown={handleKeyDown}
                     placeholder="Reply to Zen Agent"
                     disabled={disabled}
                     rows={2}
                 />
                <div className="composer__controls">
                    <button className="composer__safety-dropdown" title="Safety settings">
                        <span className="composer__safety-icon">☝</span>
                        <span>Ask before acting</span>
                        <span>▾</span>
                    </button>
                    <div className="composer__action-buttons">
                        <button
                            className="composer__icon-btn"
                            title="Magic wand"
                            disabled={disabled}
                        >
                            ✨
                        </button>
                        <button
                            className="composer__icon-btn"
                            title="Add attachment"
                            disabled={disabled}
                        >
                            ＋
                        </button>
                        {isLoading ? (
                            <button
                                className="composer__icon-btn"
                                title="Stop"
                                onClick={onStop}
                            >
                                ⏹
                            </button>
                        ) : (
                            <button
                                className="composer__icon-btn composer__icon-btn--send"
                                onClick={handleSend}
                                disabled={!canSend}
                                title="Send message"
                            >
                                ↑
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <p className="composer__disclaimer">
                AI can make mistakes. Double-check important actions.
            </p>
         </section>
    );
});
