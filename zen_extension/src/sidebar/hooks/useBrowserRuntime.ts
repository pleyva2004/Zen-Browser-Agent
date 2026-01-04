import { useCallback } from "react";

/**
 * Type declaration for the browser global
 * This is provided by the WebExtension environment
 */
declare const browser: {
    runtime: {
        sendMessage: <T = unknown>(message: unknown) => Promise<T>;
    };
};

/**
 * Hook that provides typed access to browser.runtime.sendMessage
 *
 * @returns Object with sendMessage function
 *
 * @example
 * const { sendMessage } = useBrowserRuntime();
 * const response = await sendMessage<PlanResponse>({ type: "AGENT_REQUEST", text: "search foo" });
 */
export function useBrowserRuntime() {
    /**
     * Send a message to the background script
     * @param message - The message to send
     * @returns Promise resolving to the response
     */
    const sendMessage = useCallback(<T>(message: unknown): Promise<T> => {
        return browser.runtime.sendMessage<T>(message);
    }, []);

    return { sendMessage };
}
