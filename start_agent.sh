# Start server
cd agent_server

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate

uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload

