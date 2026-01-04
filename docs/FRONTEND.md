# Frontend Architecture

The frontend is a Zen Browser sidebar extension built with **React + TypeScript + Vite**.

## Project Structure

```
zen_extension/
  src/
    sidebar/
      main.tsx                 # Entry point
      App.tsx                  # Root component
      App.css                  # Global styles
      components/
        Header.tsx             # Title + subtitle
        Chat.tsx               # Message log
        ChatMessage.tsx        # Single message bubble
        PlanViewer.tsx         # Steps list + Run next button
        StepItem.tsx           # Single step row
        Composer.tsx           # Input + Send button
      hooks/
        useAgent.ts            # Main hook for agent communication
        useBrowserRuntime.ts   # Wrapper for browser.runtime API
      types/
        index.ts               # All TypeScript interfaces
        messages.ts            # Message protocol types
        plan.ts                # Plan and Step types
      utils/
        formatStep.ts          # Step display formatting
  public/
    sidebar.html               # HTML entry (loads bundled JS)
  dist/                        # Build output
  manifest.json                # Extension manifest
  vite.config.ts
  tsconfig.json
  package.json
```

## TypeScript Interfaces

### types/messages.ts

```typescript
// Outgoing messages (sidebar -> background)
export interface AgentRequestMessage {
  type: "AGENT_REQUEST";
  text: string;
}

export interface RunNextStepMessage {
  type: "RUN_NEXT_STEP";
}

export type OutgoingMessage = AgentRequestMessage | RunNextStepMessage;

// Incoming responses (background -> sidebar)
export interface PlanResponse {
  summary: string;
  steps: Step[];
  error?: string;
}

export interface StepResultResponse {
  ranIndex?: number;
  message?: string;
  done: boolean;
  error?: string;
}
```

### types/plan.ts

```typescript
export type Tool = "CLICK" | "TYPE" | "SCROLL" | "NAVIGATE";

export interface Step {
  tool: Tool;
  selector?: string;
  text?: string;
  deltaY?: number;
  url?: string;
  note?: string;
}

export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface StepWithStatus extends Step {
  status: StepStatus;
}
```

### types/index.ts

```typescript
export * from "./messages";
export * from "./plan";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}
```

## Component Architecture

```
App
├── Header
├── Chat
│   └── ChatMessage (mapped)
├── PlanViewer
│   └── StepItem (mapped)
└── Composer
```

### App.tsx

```typescript
import { useState } from "react";
import { useAgent } from "./hooks/useAgent";
import { Header } from "./components/Header";
import { Chat } from "./components/Chat";
import { PlanViewer } from "./components/PlanViewer";
import { Composer } from "./components/Composer";
import type { ChatMessage } from "./types";
import "./App.css";

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { steps, isLoading, sendRequest, runNextStep } = useAgent();

  const handleSend = async (text: string) => {
    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date() },
    ]);

    // Send to agent
    const response = await sendRequest(text);

    // Add agent response
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "agent",
        content: response.error ?? response.summary ?? "Plan ready.",
        timestamp: new Date(),
      },
    ]);
  };

  const handleRunNext = async () => {
    const result = await runNextStep();

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "agent",
        content: result.error ?? result.message ?? "Step executed.",
        timestamp: new Date(),
      },
    ]);

    if (result.done) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "agent", content: "Plan finished.", timestamp: new Date() },
      ]);
    }
  };

  return (
    <div className="app">
      <Header />
      <Chat messages={messages} />
      <PlanViewer steps={steps} onRunNext={handleRunNext} isLoading={isLoading} />
      <Composer onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

## Custom Hooks

### hooks/useAgent.ts

```typescript
import { useState, useCallback } from "react";
import { useBrowserRuntime } from "./useBrowserRuntime";
import type { Step, StepWithStatus, PlanResponse, StepResultResponse } from "../types";

export function useAgent() {
  const [steps, setSteps] = useState<StepWithStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { sendMessage } = useBrowserRuntime();

  const sendRequest = useCallback(
    async (text: string): Promise<PlanResponse> => {
      setIsLoading(true);
      try {
        const response = await sendMessage<PlanResponse>({
          type: "AGENT_REQUEST",
          text,
        });

        const stepsWithStatus: StepWithStatus[] = (response.steps ?? []).map((step) => ({
          ...step,
          status: "pending" as const,
        }));

        setSteps(stepsWithStatus);
        setCurrentIndex(0);
        return response;
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage]
  );

  const runNextStep = useCallback(async (): Promise<StepResultResponse> => {
    setIsLoading(true);

    // Mark current step as running
    setSteps((prev) =>
      prev.map((step, i) => (i === currentIndex ? { ...step, status: "running" } : step))
    );

    try {
      const result = await sendMessage<StepResultResponse>({ type: "RUN_NEXT_STEP" });

      if (typeof result.ranIndex === "number") {
        // Mark step as completed
        setSteps((prev) =>
          prev.map((step, i) =>
            i === result.ranIndex ? { ...step, status: result.error ? "failed" : "completed" } : step
          )
        );
        setCurrentIndex((prev) => prev + 1);
      }

      return result;
    } catch (error) {
      // Mark step as failed
      setSteps((prev) =>
        prev.map((step, i) => (i === currentIndex ? { ...step, status: "failed" } : step))
      );
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentIndex, sendMessage]);

  const hasStepsRemaining = currentIndex < steps.length;

  return {
    steps,
    currentIndex,
    isLoading,
    hasStepsRemaining,
    sendRequest,
    runNextStep,
  };
}
```

### hooks/useBrowserRuntime.ts

```typescript
import { useCallback } from "react";

// Type the browser global (from webextension-polyfill)
declare const browser: {
  runtime: {
    sendMessage: <T>(message: unknown) => Promise<T>;
  };
};

export function useBrowserRuntime() {
  const sendMessage = useCallback(<T>(message: unknown): Promise<T> => {
    return browser.runtime.sendMessage<T>(message);
  }, []);

  return { sendMessage };
}
```

## UI Components

### components/Header.tsx

```typescript
export function Header() {
  return (
    <header className="header">
      <h1 className="header-title">Zen Tab Agent</h1>
      <p className="header-subtitle">Plan → Run next → Observe</p>
    </header>
  );
}
```

### components/Chat.tsx

```typescript
import { useEffect, useRef } from "react";
import { ChatMessage as ChatMessageType } from "../types";
import { ChatMessage } from "./ChatMessage";

interface Props {
  messages: ChatMessageType[];
}

export function Chat({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section className="chat">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </section>
  );
}
```

### components/PlanViewer.tsx

```typescript
import type { StepWithStatus } from "../types";
import { StepItem } from "./StepItem";

interface Props {
  steps: StepWithStatus[];
  onRunNext: () => void;
  isLoading: boolean;
}

export function PlanViewer({ steps, onRunNext, isLoading }: Props) {
  const hasSteps = steps.length > 0;
  const allComplete = steps.every((s) => s.status === "completed");
  const canRun = hasSteps && !allComplete && !isLoading;

  return (
    <section className="plan-box">
      <div className="plan-header">
        <span className="plan-title">Plan</span>
        <button onClick={onRunNext} disabled={!canRun} className="run-next-btn">
          {isLoading ? "Running..." : "Run next"}
        </button>
      </div>
      {hasSteps && (
        <ol className="steps-list">
          {steps.map((step, index) => (
            <StepItem key={index} step={step} index={index} />
          ))}
        </ol>
      )}
    </section>
  );
}
```

### components/Composer.tsx

```typescript
import { useState, KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function Composer({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="composer">
      <textarea
        className="composer-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. search nvidia ignite, click Sign in, scroll down"
        disabled={disabled}
      />
      <button onClick={handleSend} disabled={disabled || !value.trim()} className="send-btn">
        Send
      </button>
    </section>
  );
}
```

## UI Layout

```
┌─────────────────────────────┐
│  Zen Tab Agent              │  <- Header
│  Plan → Run next → Observe  │
├─────────────────────────────┤
│  you: search transformers   │  <- Chat
│  agent: Plan ready.         │
│  agent: Step executed.      │
├─────────────────────────────┤
│  Plan              [Run next]│  <- PlanViewer
│  1. ✓ CLICK — Focus          │
│  2. ● TYPE — Typing...       │  <- StepItem (with status icons)
│  3. ○ CLICK — Submit         │
├─────────────────────────────┤
│  ┌─────────────────────────┐│  <- Composer
│  │ e.g. search nvidia...   ││
│  └─────────────────────────┘│
│                      [Send] │
└─────────────────────────────┘
```

## State Management

Using React's built-in `useState`. No external state library needed for MVP.

| State | Location | Purpose |
|-------|----------|---------|
| `messages` | App.tsx | Chat history |
| `steps` | useAgent hook | Current plan steps with status |
| `currentIndex` | useAgent hook | Which step to run next |
| `isLoading` | useAgent hook | Disable UI during async ops |
| `value` | Composer | Controlled textarea input |

## Vite Configuration

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, "src/sidebar/index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    // Required for extension CSP compliance
    cssCodeSplit: false,
    modulePreload: false,
  },
  // No inline scripts for CSP
  experimental: {
    renderBuiltUrl(filename) {
      return filename;
    },
  },
});
```

### manifest.json (updated)

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

## Development Commands

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

### package.json scripts

```json
{
  "scripts": {
    "dev": "vite build --watch",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx"
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
    "vite": "^5.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint-plugin-react-hooks": "^4.6.0"
  }
}
```

## Development Workflow

1. Run `npm run dev` (Vite watches and rebuilds)
2. In Zen Browser: `about:debugging` → Load Temporary Add-on → select `manifest.json`
3. Make changes → Vite rebuilds automatically
4. Click "Reload" on the extension in `about:debugging`

## Communication Flow

```
React Components
      │
      ▼
useAgent hook ──sendMessage──▶ background.js ──fetch──▶ FastAPI
      │                              │
      │                              ▼
      ◀────────response────────  content script
      │
      ▼
Update state → Re-render
```

## Error Handling

Errors are handled at the hook level and surfaced through the response:

```typescript
// In useAgent.ts
try {
  const response = await sendMessage<PlanResponse>({ type: "AGENT_REQUEST", text });
  // success path
} catch (error) {
  return { error: String(error), summary: "", steps: [] };
}
```

Components display errors in the chat:

```typescript
content: response.error ?? response.summary ?? "Plan ready."
```

## Styling Approach

CSS Modules or plain CSS (in App.css). Key classes:

| Class | Purpose |
|-------|---------|
| `.app` | Flex column, full height |
| `.header` | Fixed top section |
| `.chat` | Scrollable, flex-grow |
| `.plan-box` | Fixed section with steps |
| `.composer` | Fixed bottom input |
| `.step-completed` | Strikethrough + opacity |
| `.step-running` | Loading indicator |
