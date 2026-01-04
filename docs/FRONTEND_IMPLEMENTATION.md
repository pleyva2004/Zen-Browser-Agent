# Frontend Implementation Guide

A complete, step-by-step walkthrough to build the React + TypeScript + Vite sidebar UI from scratch.

---

## Table of Contents

- [Step 0: Directory Setup](#step-0-directory-setup)
- [Step 1: Initialize npm and Install Dependencies](#step-1-initialize-npm-and-install-dependencies)
- [Step 2: Create TypeScript Configuration](#step-2-create-typescript-configuration)
- [Step 3: Create Vite Configuration](#step-3-create-vite-configuration)
- [Step 4: Create Package.json Scripts](#step-4-create-packagejson-scripts)
- [Step 5: Create HTML Entry Point](#step-5-create-html-entry-point)
- [Step 6: Create React Entry Point](#step-6-create-react-entry-point)
- [Step 7: Define TypeScript Types - Plan Types](#step-7-define-typescript-types---plan-types)
- [Step 8: Define TypeScript Types - Message Types](#step-8-define-typescript-types---message-types)
- [Step 9: Define TypeScript Types - Index Barrel](#step-9-define-typescript-types---index-barrel)
- [Step 10: Create Browser Runtime Hook](#step-10-create-browser-runtime-hook)
- [Step 11: Create Agent Hook](#step-11-create-agent-hook)
- [Step 12: Create Header Component](#step-12-create-header-component)
- [Step 13: Create ChatMessage Component](#step-13-create-chatmessage-component)
- [Step 14: Create Chat Component](#step-14-create-chat-component)
- [Step 15: Create StepItem Component](#step-15-create-stepitem-component)
- [Step 16: Create PlanViewer Component](#step-16-create-planviewer-component)
- [Step 17: Create Composer Component](#step-17-create-composer-component)
- [Step 18: Create App Styles](#step-18-create-app-styles)
- [Step 19: Create App Component](#step-19-create-app-component)
- [Step 20: Build and Verify](#step-20-build-and-verify)
- [Step 21: Update Extension Manifest](#step-21-update-extension-manifest)
- [Step 22: Test in Browser](#step-22-test-in-browser)

---

## Step 0: Directory Setup

Create the complete directory structure for the frontend.

### 0.1 Navigate to the extension folder

```bash
mkdir -p zen_extension
cd zen_extension
```

### 0.2 Create the directory structure

```bash
# Create all directories
mkdir -p src/sidebar/components
mkdir -p src/sidebar/hooks
mkdir -p src/sidebar/types
mkdir -p src/sidebar/utils
mkdir -p public
```

### 0.3 Verify the structure

```bash
tree src public
```

Expected output:
```
src
└── sidebar
    ├── components
    ├── hooks
    ├── types
    └── utils
public
```

---

## Step 1: Initialize npm and Install Dependencies

### 1.1 Initialize package.json

```bash
npm init -y
```

This creates a basic `package.json`.

### 1.2 Install React dependencies

```bash
npm install react react-dom
```

### 1.3 Install development dependencies

```bash
npm install -D typescript vite @vitejs/plugin-react
```

### 1.4 Install TypeScript type definitions

```bash
npm install -D @types/react @types/react-dom @types/webextension-polyfill
```

### 1.5 Verify installation

```bash
cat package.json
```

Your `dependencies` and `devDependencies` should include:
```json
{
  "dependencies": {
    "react": "^18.x.x",
    "react-dom": "^18.x.x"
  },
  "devDependencies": {
    "@types/react": "^18.x.x",
    "@types/react-dom": "^18.x.x",
    "@types/webextension-polyfill": "^0.10.x",
    "@vitejs/plugin-react": "^4.x.x",
    "typescript": "^5.x.x",
    "vite": "^5.x.x"
  }
}
```

---

## Step 2: Create TypeScript Configuration

Create `tsconfig.json` in the `zen_extension` root.

### 2.1 Create the file

```bash
touch tsconfig.json
```

### 2.2 Add configuration

**File: `zen_extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["src/sidebar/*"]
    }
  },
  "include": ["src"]
}
```

### 2.3 Configuration explained

| Option | Purpose |
|--------|---------|
| `target: ES2020` | Modern JS output |
| `jsx: react-jsx` | Use new JSX transform (no import React needed) |
| `strict: true` | Enable all strict type checks |
| `noEmit: true` | Vite handles compilation, TS only type-checks |
| `paths` | Optional path aliases for cleaner imports |

---

## Step 3: Create Vite Configuration

Create `vite.config.ts` in the `zen_extension` root.

### 3.1 Create the file

```bash
touch vite.config.ts
```

### 3.2 Add configuration

**File: `zen_extension/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],

  root: ".",

  build: {
    // Output directory
    outDir: "dist",

    // Don't empty outDir (we have other extension files)
    emptyOutDir: false,

    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, "public/sidebar.html"),
      },
      output: {
        // Predictable file names (no hashes)
        entryFileNames: "sidebar.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },

    // Required for extension CSP compliance
    cssCodeSplit: false,
    modulePreload: false,

    // Generate source maps for debugging
    sourcemap: true,
  },

  // Resolve path aliases
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/sidebar"),
    },
  },
});
```

### 3.3 Configuration explained

| Option | Purpose |
|--------|---------|
| `outDir: dist` | Build output goes to `dist/` |
| `emptyOutDir: false` | Preserve other files in dist |
| `entryFileNames: sidebar.js` | Predictable output name |
| `cssCodeSplit: false` | Single CSS file for CSP |
| `modulePreload: false` | Disable module preload for extensions |
| `sourcemap: true` | Enable debugging |

---

## Step 4: Create Package.json Scripts

Update `package.json` with build scripts.

### 4.1 Edit package.json

Open `package.json` and add/update the `scripts` section:

**File: `zen_extension/package.json`** (partial)

```json
{
  "name": "zen-extension",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/webextension-polyfill": "^0.10.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### 4.2 Scripts explained

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode - rebuilds on file changes |
| `npm run build` | Production build with type checking |
| `npm run typecheck` | Type check without building |

---

## Step 5: Create HTML Entry Point

Create the HTML file that loads the React app.

### 5.1 Create the file

```bash
touch public/sidebar.html
```

### 5.2 Add HTML content

**File: `zen_extension/public/sidebar.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zen Tab Agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="../src/sidebar/main.tsx"></script>
  </body>
</html>
```

### 5.3 Key points

- `<div id="root">` - React mounts here
- `type="module"` - Required for ES modules
- Path `../src/sidebar/main.tsx` - Relative to public folder

---

## Step 6: Create React Entry Point

Create the main entry file that bootstraps React.

### 6.1 Create the file

```bash
touch src/sidebar/main.tsx
```

### 6.2 Add entry point code

**File: `zen_extension/src/sidebar/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./App.css";

// Get the root element
const rootElement = document.getElementById("root");

// Ensure root exists
if (!rootElement) {
  throw new Error("Root element not found. Check sidebar.html has <div id='root'>");
}

// Create React root and render
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### 6.3 Key points

- `StrictMode` enables additional development checks
- `createRoot` is the React 18 API
- Error thrown if root element missing (helps debugging)

---

## Step 7: Define TypeScript Types - Plan Types

Create types for plan steps and tool operations.

### 7.1 Create the file

```bash
touch src/sidebar/types/plan.ts
```

### 7.2 Add type definitions

**File: `zen_extension/src/sidebar/types/plan.ts`**

```typescript
/**
 * Available tool operations the agent can execute
 */
export type Tool = "CLICK" | "TYPE" | "SCROLL" | "NAVIGATE";

/**
 * A single step in an execution plan
 */
export interface Step {
  /** The tool/action to execute */
  tool: Tool;

  /** CSS selector for the target element (CLICK, TYPE) */
  selector?: string;

  /** Text to type (TYPE only) */
  text?: string;

  /** Scroll amount in pixels (SCROLL only) */
  deltaY?: number;

  /** URL to navigate to (NAVIGATE only) */
  url?: string;

  /** Human-readable explanation of this step */
  note?: string;
}

/**
 * Possible states for a step during execution
 */
export type StepStatus = "pending" | "running" | "completed" | "failed";

/**
 * Step with runtime status tracking
 */
export interface StepWithStatus extends Step {
  status: StepStatus;
}
```

### 7.3 Type design notes

- `Tool` is a union type for type safety
- `Step` matches the server's response schema
- `StepWithStatus` extends `Step` for UI state tracking
- Optional fields use `?` suffix

---

## Step 8: Define TypeScript Types - Message Types

Create types for the message protocol between sidebar and background script.

### 8.1 Create the file

```bash
touch src/sidebar/types/messages.ts
```

### 8.2 Add type definitions

**File: `zen_extension/src/sidebar/types/messages.ts`**

```typescript
import type { Step } from "./plan";

// ============================================
// OUTGOING MESSAGES (Sidebar -> Background)
// ============================================

/**
 * Request to plan actions for a user goal
 */
export interface AgentRequestMessage {
  type: "AGENT_REQUEST";
  text: string;
}

/**
 * Request to execute the next step in the plan
 */
export interface RunNextStepMessage {
  type: "RUN_NEXT_STEP";
}

/**
 * Union of all outgoing message types
 */
export type OutgoingMessage = AgentRequestMessage | RunNextStepMessage;

// ============================================
// INCOMING RESPONSES (Background -> Sidebar)
// ============================================

/**
 * Response after requesting a plan
 */
export interface PlanResponse {
  /** Human-readable summary of the plan */
  summary: string;

  /** List of steps to execute */
  steps: Step[];

  /** Error message if planning failed */
  error?: string;
}

/**
 * Response after running a step
 */
export interface StepResultResponse {
  /** Index of the step that was executed */
  ranIndex?: number;

  /** Human-readable result message */
  message?: string;

  /** Whether all steps are complete */
  done: boolean;

  /** Error message if step failed */
  error?: string;
}
```

### 8.3 Message design notes

- Messages are discriminated by `type` field
- Responses may contain `error` for failure handling
- Types match what `background.js` sends/receives

---

## Step 9: Define TypeScript Types - Index Barrel

Create an index file to export all types from a single location.

### 9.1 Create the file

```bash
touch src/sidebar/types/index.ts
```

### 9.2 Add barrel exports

**File: `zen_extension/src/sidebar/types/index.ts`**

```typescript
// Re-export all types from a single entry point
export * from "./plan";
export * from "./messages";

/**
 * A single message in the chat history
 */
export interface ChatMessage {
  /** Unique identifier for React keys */
  id: string;

  /** Who sent the message */
  role: "user" | "agent";

  /** Message content */
  content: string;

  /** When the message was created */
  timestamp: Date;
}
```

### 9.3 Usage

Now you can import all types from one place:

```typescript
import type { Step, StepWithStatus, ChatMessage, PlanResponse } from "./types";
```

---

## Step 10: Create Browser Runtime Hook

Create a hook that wraps the browser extension messaging API.

### 10.1 Create the file

```bash
touch src/sidebar/hooks/useBrowserRuntime.ts
```

### 10.2 Add hook implementation

**File: `zen_extension/src/sidebar/hooks/useBrowserRuntime.ts`**

```typescript
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
```

### 10.3 Hook design notes

- `declare const browser` tells TypeScript about the global
- Generic `<T>` allows typed responses
- `useCallback` with empty deps means stable reference
- This abstraction makes testing easier (can mock the hook)

---

## Step 11: Create Agent Hook

Create the main hook that manages agent communication and state.

### 11.1 Create the file

```bash
touch src/sidebar/hooks/useAgent.ts
```

### 11.2 Add hook implementation

**File: `zen_extension/src/sidebar/hooks/useAgent.ts`**

```typescript
import { useState, useCallback } from "react";
import { useBrowserRuntime } from "./useBrowserRuntime";
import type {
  Step,
  StepWithStatus,
  PlanResponse,
  StepResultResponse,
} from "../types";

/**
 * Hook that manages agent communication and plan execution state
 *
 * @returns Object with state and action functions
 *
 * @example
 * const { steps, isLoading, sendRequest, runNextStep } = useAgent();
 *
 * // Send a request
 * const response = await sendRequest("search for cats");
 *
 * // Run next step
 * const result = await runNextStep();
 */
export function useAgent() {
  // Current plan steps with execution status
  const [steps, setSteps] = useState<StepWithStatus[]>([]);

  // Index of the next step to execute
  const [currentIndex, setCurrentIndex] = useState(0);

  // Loading state for async operations
  const [isLoading, setIsLoading] = useState(false);

  // Get the messaging function
  const { sendMessage } = useBrowserRuntime();

  /**
   * Send a goal to the agent and receive a plan
   */
  const sendRequest = useCallback(
    async (text: string): Promise<PlanResponse> => {
      setIsLoading(true);

      try {
        // Send request to background script
        const response = await sendMessage<PlanResponse>({
          type: "AGENT_REQUEST",
          text,
        });

        // Handle error response
        if (response.error) {
          setSteps([]);
          setCurrentIndex(0);
          return response;
        }

        // Transform steps to include status
        const stepsWithStatus: StepWithStatus[] = (response.steps ?? []).map(
          (step: Step) => ({
            ...step,
            status: "pending" as const,
          })
        );

        // Update state
        setSteps(stepsWithStatus);
        setCurrentIndex(0);

        return response;
      } catch (error) {
        // Return error response
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          summary: "",
          steps: [],
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage]
  );

  /**
   * Execute the next step in the plan
   */
  const runNextStep = useCallback(async (): Promise<StepResultResponse> => {
    // Check if there are steps to run
    if (currentIndex >= steps.length) {
      return { done: true, message: "No steps left." };
    }

    setIsLoading(true);

    // Mark current step as running
    setSteps((prev) =>
      prev.map((step, i) =>
        i === currentIndex ? { ...step, status: "running" } : step
      )
    );

    try {
      // Send run request to background
      const result = await sendMessage<StepResultResponse>({
        type: "RUN_NEXT_STEP",
      });

      // Update step status based on result
      if (typeof result.ranIndex === "number") {
        setSteps((prev) =>
          prev.map((step, i) =>
            i === result.ranIndex
              ? { ...step, status: result.error ? "failed" : "completed" }
              : step
          )
        );
        setCurrentIndex((prev) => prev + 1);
      }

      return result;
    } catch (error) {
      // Mark step as failed
      setSteps((prev) =>
        prev.map((step, i) =>
          i === currentIndex ? { ...step, status: "failed" } : step
        )
      );

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        done: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [currentIndex, steps.length, sendMessage]);

  /**
   * Reset the agent state
   */
  const reset = useCallback(() => {
    setSteps([]);
    setCurrentIndex(0);
    setIsLoading(false);
  }, []);

  // Computed values
  const hasStepsRemaining = currentIndex < steps.length;
  const allStepsComplete =
    steps.length > 0 && steps.every((s) => s.status === "completed");

  return {
    // State
    steps,
    currentIndex,
    isLoading,
    hasStepsRemaining,
    allStepsComplete,

    // Actions
    sendRequest,
    runNextStep,
    reset,
  };
}
```

### 11.3 Hook state diagram

```
Initial State:
  steps: []
  currentIndex: 0
  isLoading: false

After sendRequest("search cats"):
  steps: [
    { tool: "CLICK", status: "pending" },
    { tool: "TYPE", status: "pending" },
    { tool: "CLICK", status: "pending" }
  ]
  currentIndex: 0

After runNextStep():
  steps: [
    { tool: "CLICK", status: "completed" },  <- was "running" then "completed"
    { tool: "TYPE", status: "pending" },
    { tool: "CLICK", status: "pending" }
  ]
  currentIndex: 1
```

---

## Step 12: Create Header Component

Create the header component that displays the app title.

### 12.1 Create the file

```bash
touch src/sidebar/components/Header.tsx
```

### 12.2 Add component implementation

**File: `zen_extension/src/sidebar/components/Header.tsx`**

```tsx
/**
 * Header component displaying the app title and subtitle
 */
export function Header() {
  return (
    <header className="header">
      <h1 className="header-title">Zen Tab Agent</h1>
      <p className="header-subtitle">Plan → Run next → Observe</p>
    </header>
  );
}
```

### 12.3 Component notes

- Simple presentational component
- No props needed
- CSS classes defined in App.css

---

## Step 13: Create ChatMessage Component

Create a component to display a single chat message.

### 13.1 Create the file

```bash
touch src/sidebar/components/ChatMessage.tsx
```

### 13.2 Add component implementation

**File: `zen_extension/src/sidebar/components/ChatMessage.tsx`**

```tsx
import type { ChatMessage as ChatMessageType } from "../types";

interface Props {
  message: ChatMessageType;
}

/**
 * Displays a single chat message with role indicator
 */
export function ChatMessage({ message }: Props) {
  const roleLabel = message.role === "user" ? "you" : "agent";

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <span className="chat-message__role">{roleLabel}:</span>
      <span className="chat-message__content">{message.content}</span>
    </div>
  );
}
```

### 13.3 Component notes

- Uses BEM naming convention for CSS classes
- `role` determines styling (user vs agent)
- Displays role label followed by content

---

## Step 14: Create Chat Component

Create the chat container that displays all messages.

### 14.1 Create the file

```bash
touch src/sidebar/components/Chat.tsx
```

### 14.2 Add component implementation

**File: `zen_extension/src/sidebar/components/Chat.tsx`**

```tsx
import { useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "../types";
import { ChatMessage } from "./ChatMessage";

interface Props {
  messages: ChatMessageType[];
}

/**
 * Chat container that displays messages and auto-scrolls to bottom
 */
export function Chat({ messages }: Props) {
  // Ref to the bottom element for scrolling
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <section className="chat">
      {messages.length === 0 ? (
        <div className="chat__empty">
          Type a goal below to get started.
        </div>
      ) : (
        messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
      )}
      {/* Invisible element at bottom for scroll targeting */}
      <div ref={bottomRef} />
    </section>
  );
}
```

### 14.3 Component features

- Auto-scrolls to bottom when messages change
- Shows empty state when no messages
- Uses `key={msg.id}` for efficient React reconciliation

---

## Step 15: Create StepItem Component

Create a component to display a single plan step.

### 15.1 Create the file

```bash
touch src/sidebar/components/StepItem.tsx
```

### 15.2 Add component implementation

**File: `zen_extension/src/sidebar/components/StepItem.tsx`**

```tsx
import type { StepWithStatus } from "../types";

interface Props {
  step: StepWithStatus;
  index: number;
}

/**
 * Get status icon for a step
 */
function getStatusIcon(status: StepWithStatus["status"]): string {
  switch (status) {
    case "pending":
      return "○";
    case "running":
      return "●";
    case "completed":
      return "✓";
    case "failed":
      return "✗";
  }
}

/**
 * Format step details for display
 */
function formatStepDetails(step: StepWithStatus): string {
  switch (step.tool) {
    case "CLICK":
      return `CLICK ${step.selector ? `(${step.selector})` : ""}`;
    case "TYPE":
      return `TYPE "${step.text?.slice(0, 30) ?? ""}"${
        (step.text?.length ?? 0) > 30 ? "..." : ""
      }`;
    case "SCROLL":
      return `SCROLL (${step.deltaY ?? 0}px)`;
    case "NAVIGATE":
      return `NAVIGATE ${step.url ?? ""}`;
    default:
      return step.tool;
  }
}

/**
 * Displays a single step with status indicator
 */
export function StepItem({ step, index }: Props) {
  const icon = getStatusIcon(step.status);
  const details = formatStepDetails(step);

  return (
    <li className={`step-item step-item--${step.status}`}>
      <span className="step-item__icon">{icon}</span>
      <span className="step-item__number">{index + 1}.</span>
      <span className="step-item__details">{details}</span>
      {step.note && <span className="step-item__note"> — {step.note}</span>}
    </li>
  );
}
```

### 15.3 Status icons

| Status | Icon | Meaning |
|--------|------|---------|
| pending | ○ | Not started |
| running | ● | Currently executing |
| completed | ✓ | Successfully finished |
| failed | ✗ | Error occurred |

---

## Step 16: Create PlanViewer Component

Create the component that displays the plan and run button.

### 16.1 Create the file

```bash
touch src/sidebar/components/PlanViewer.tsx
```

### 16.2 Add component implementation

**File: `zen_extension/src/sidebar/components/PlanViewer.tsx`**

```tsx
import type { StepWithStatus } from "../types";
import { StepItem } from "./StepItem";

interface Props {
  steps: StepWithStatus[];
  onRunNext: () => void;
  isLoading: boolean;
}

/**
 * Displays the execution plan with steps and run button
 */
export function PlanViewer({ steps, onRunNext, isLoading }: Props) {
  // Determine button state
  const hasSteps = steps.length > 0;
  const allComplete = steps.every((s) => s.status === "completed");
  const hasFailed = steps.some((s) => s.status === "failed");
  const canRun = hasSteps && !allComplete && !hasFailed && !isLoading;

  // Determine button text
  const getButtonText = (): string => {
    if (isLoading) return "Running...";
    if (allComplete) return "Complete";
    if (hasFailed) return "Failed";
    return "Run next";
  };

  return (
    <section className="plan-viewer">
      <div className="plan-viewer__header">
        <span className="plan-viewer__title">Plan</span>
        <button
          className="plan-viewer__button"
          onClick={onRunNext}
          disabled={!canRun}
        >
          {getButtonText()}
        </button>
      </div>

      {hasSteps ? (
        <ol className="plan-viewer__steps">
          {steps.map((step, index) => (
            <StepItem key={index} step={step} index={index} />
          ))}
        </ol>
      ) : (
        <div className="plan-viewer__empty">No plan yet.</div>
      )}
    </section>
  );
}
```

### 16.3 Button states

| Condition | Text | Enabled |
|-----------|------|---------|
| Loading | "Running..." | No |
| All complete | "Complete" | No |
| Has failed step | "Failed" | No |
| Has pending steps | "Run next" | Yes |
| No steps | "Run next" | No |

---

## Step 17: Create Composer Component

Create the input component for typing goals.

### 17.1 Create the file

```bash
touch src/sidebar/components/Composer.tsx
```

### 17.2 Add component implementation

**File: `zen_extension/src/sidebar/components/Composer.tsx`**

```tsx
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
```

### 17.3 Keyboard shortcuts

| Key | Behavior |
|-----|----------|
| Enter | Send message |
| Shift+Enter | New line |

---

## Step 18: Create App Styles

Create the CSS file with all component styles.

### 18.1 Create the file

```bash
touch src/sidebar/App.css
```

### 18.2 Add styles

**File: `zen_extension/src/sidebar/App.css`**

```css
/* ============================================
   CSS Variables
   ============================================ */
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-success: #22c55e;
  --color-error: #ef4444;
  --color-warning: #f59e0b;

  --font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-size-sm: 12px;
  --font-size-base: 14px;

  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;

  --radius-sm: 4px;
  --radius-md: 8px;
}

/* ============================================
   Base Styles
   ============================================ */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.5;
}

/* ============================================
   App Layout
   ============================================ */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ============================================
   Header
   ============================================ */
.header {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.header-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--spacing-xs);
}

/* ============================================
   Chat
   ============================================ */
.chat {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.chat__empty {
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--spacing-lg);
}

/* ============================================
   Chat Message
   ============================================ */
.chat-message {
  margin-bottom: var(--spacing-sm);
  line-height: 1.4;
}

.chat-message__role {
  font-weight: 600;
  margin-right: var(--spacing-xs);
}

.chat-message--user .chat-message__role {
  color: var(--color-primary);
}

.chat-message--agent .chat-message__role {
  color: var(--color-text-muted);
}

.chat-message__content {
  word-break: break-word;
}

/* ============================================
   Plan Viewer
   ============================================ */
.plan-viewer {
  border-top: 1px solid var(--color-border);
  padding: var(--spacing-md);
  flex-shrink: 0;
  max-height: 200px;
  overflow-y: auto;
}

.plan-viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.plan-viewer__title {
  font-weight: 600;
}

.plan-viewer__button {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: background 0.15s;
}

.plan-viewer__button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.plan-viewer__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plan-viewer__steps {
  list-style: none;
  margin: 0;
  padding: 0;
}

.plan-viewer__empty {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* ============================================
   Step Item
   ============================================ */
.step-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);
}

.step-item__icon {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.step-item__number {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.step-item__details {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.step-item__note {
  color: var(--color-text-muted);
}

/* Step status colors */
.step-item--pending .step-item__icon {
  color: var(--color-text-muted);
}

.step-item--running .step-item__icon {
  color: var(--color-warning);
}

.step-item--completed {
  opacity: 0.6;
}

.step-item--completed .step-item__icon {
  color: var(--color-success);
}

.step-item--completed .step-item__details {
  text-decoration: line-through;
}

.step-item--failed .step-item__icon {
  color: var(--color-error);
}

/* ============================================
   Composer
   ============================================ */
.composer {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.composer__input {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--font-size-base);
  resize: none;
  min-height: 60px;
}

.composer__input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.composer__input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.composer__button {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
  align-self: flex-end;
  transition: background 0.15s;
}

.composer__button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.composer__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 18.3 CSS architecture notes

- CSS Variables for theming
- BEM naming convention
- Mobile-first (sidebar is narrow by default)
- Flexbox layout for main structure

---

## Step 19: Create App Component

Create the root component that brings everything together.

### 19.1 Create the file

```bash
touch src/sidebar/App.tsx
```

### 19.2 Add component implementation

**File: `zen_extension/src/sidebar/App.tsx`**

```tsx
import { useState, useCallback } from "react";
import { useAgent } from "./hooks/useAgent";
import { Header } from "./components/Header";
import { Chat } from "./components/Chat";
import { PlanViewer } from "./components/PlanViewer";
import { Composer } from "./components/Composer";
import type { ChatMessage } from "./types";

/**
 * Generate a unique ID for messages
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Root application component
 */
export function App() {
  // Chat message history
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Agent hook for communication
  const { steps, isLoading, sendRequest, runNextStep } = useAgent();

  /**
   * Add a message to the chat
   */
  const addMessage = useCallback((role: ChatMessage["role"], content: string) => {
    const message: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  /**
   * Handle sending a user goal
   */
  const handleSend = useCallback(
    async (text: string) => {
      // Add user message
      addMessage("user", text);

      // Send to agent
      const response = await sendRequest(text);

      // Add agent response
      if (response.error) {
        addMessage("agent", `Error: ${response.error}`);
      } else {
        addMessage("agent", response.summary || "Plan ready.");
      }
    },
    [addMessage, sendRequest]
  );

  /**
   * Handle running the next step
   */
  const handleRunNext = useCallback(async () => {
    const result = await runNextStep();

    // Add result message
    if (result.error) {
      addMessage("agent", `Error: ${result.error}`);
    } else if (result.message) {
      addMessage("agent", result.message);
    }

    // Add completion message
    if (result.done && !result.error) {
      addMessage("agent", "Plan finished.");
    }
  }, [addMessage, runNextStep]);

  return (
    <div className="app">
      <Header />
      <Chat messages={messages} />
      <PlanViewer
        steps={steps}
        onRunNext={handleRunNext}
        isLoading={isLoading}
      />
      <Composer onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

### 19.3 Component data flow

```
App
├── messages state
├── useAgent hook
│   ├── steps
│   ├── isLoading
│   ├── sendRequest
│   └── runNextStep
│
├── Header (no props)
├── Chat
│   └── messages
├── PlanViewer
│   ├── steps
│   ├── onRunNext → handleRunNext
│   └── isLoading
└── Composer
    ├── onSend → handleSend
    └── disabled ← isLoading
```

---

## Step 20: Build and Verify

Build the project and verify the output.

### 20.1 Run type check

```bash
npm run typecheck
```

Expected output:
```
(no errors)
```

### 20.2 Build the project

```bash
npm run build
```

Expected output:
```
vite v5.x.x building for production...
✓ x modules transformed.
dist/sidebar.html    x.xx kB
dist/sidebar.js      xx.xx kB
dist/sidebar.css     x.xx kB
✓ built in xxxms
```

### 20.3 Verify output files

```bash
ls -la dist/
```

You should see:
```
sidebar.html
sidebar.js
sidebar.css
```

### 20.4 Check the built HTML

```bash
cat dist/sidebar.html
```

It should reference the built JS and CSS:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="sidebar.css">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="sidebar.js"></script>
  </body>
</html>
```

---

## Step 21: Update Extension Manifest

Update the manifest to use the built sidebar.

### 21.1 Edit manifest.json

**File: `zen_extension/manifest.json`**

```json
{
  "manifest_version": 2,
  "name": "Zen Tab Agent (Sidebar)",
  "version": "0.1.0",
  "description": "Sidebar agent that reads/acts inside the current tab.",

  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "<all_urls>",
    "http://127.0.0.1/*"
  ],

  "background": {
    "scripts": ["background.js"]
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["contentScript.js"],
      "run_at": "document_idle"
    }
  ],

  "sidebar_action": {
    "default_title": "Zen Agent",
    "default_panel": "dist/sidebar.html",
    "open_at_install": true
  },

  "content_security_policy": "script-src 'self'; object-src 'self'"
}
```

### 21.2 Key manifest changes

| Field | Value | Purpose |
|-------|-------|---------|
| `default_panel` | `dist/sidebar.html` | Points to built React app |
| `content_security_policy` | `script-src 'self'` | Allows only local scripts (CSP compliant) |

---

## Step 22: Test in Browser

Load and test the extension in Zen Browser.

### 22.1 Start the agent server

In a terminal:
```bash
cd agent_server
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 8765 --reload
```

### 22.2 Load the extension

1. Open Zen Browser
2. Navigate to `about:debugging`
3. Click "This Firefox" (or "This Zen")
4. Click "Load Temporary Add-on..."
5. Select `zen_extension/manifest.json`

### 22.3 Open the sidebar

1. Navigate to any webpage (e.g., google.com)
2. Click the sidebar icon or press the sidebar shortcut
3. You should see the Zen Tab Agent UI

### 22.4 Test the flow

1. Type a goal: `search hello world`
2. Click "Send" (or press Enter)
3. Observe the plan appears
4. Click "Run next" to execute each step
5. Watch steps change from ○ to ● to ✓

### 22.5 Development workflow

For iterative development:

Terminal 1 - Agent server:
```bash
uvicorn app:app --host 127.0.0.1 --port 8765 --reload
```

Terminal 2 - Vite watch mode:
```bash
cd zen_extension
npm run dev
```

After making changes:
1. Vite auto-rebuilds
2. Go to `about:debugging`
3. Click "Reload" on your extension
4. Refresh the sidebar

---

## Summary

You have now built a complete React + TypeScript sidebar extension with:

| Component | Purpose |
|-----------|---------|
| Types | Type-safe message protocol and plan structures |
| useBrowserRuntime | Abstraction over browser extension API |
| useAgent | State management for agent communication |
| Header | App title and subtitle |
| Chat | Message history with auto-scroll |
| ChatMessage | Individual message display |
| PlanViewer | Plan steps with execution control |
| StepItem | Single step with status indicator |
| Composer | Text input for goals |
| App | Root component orchestrating everything |

**File count:** 14 source files + 3 config files

**Total lines of code:** ~700 lines (excluding CSS)

---

## Next Steps

1. **Add error boundaries** for graceful error handling
2. **Add loading skeletons** for better UX during loading
3. **Persist chat history** using browser.storage API
4. **Add keyboard shortcuts** for power users
5. **Add dark mode** support using CSS variables
