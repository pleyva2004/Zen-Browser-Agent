# Zen Tab Agent

A browser sidebar agent for Zen Browser that automates web interactions using natural language commands.
**Current Status:** Prototype (Rule-based).

## Use Case
Execute repetitive browser tasks (clicking, typing, scrolling) without leaving your current tab, using a conversational interface.

## Setup Instructions

### 1. Start the Backend Server (Required)
The python server handles the planning logic.
```bash
cd agent_server
python3 -m venv .venv        # Create venv (use python3.9+ if 3.14 fails)
source .venv/bin/activate    # Activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8765 --reload
```

### 2. Build the Extension (Frontend)
Since the build artifacts are not committed, you must build them.
```bash
cd zen_extension
npm install
npm run build
```

### 3. Load Extension in Zen Browser
1.  Open Zen Browser and type `about:debugging` in the address bar.
2.  Click **"This Firefox"** (or "This Zen") on the left sidebar.
3.  Click **"Load Temporary Add-on..."**.
4.  Select `zen_extension/manifest.json`.

### 4. Usage
- Open the sidebar using `Cmd+B` (or `Ctrl+B`).
- Select **"Zen Tab Agent"** from the sidebar dropdown.
- Try commands: `search nvidia`, `scroll down`, `click Sign in`.
