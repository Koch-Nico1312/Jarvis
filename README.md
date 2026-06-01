# MARK XXXIX

MARK XXXIX is a desktop AI assistant built around voice interaction, tool calling, local automation, memory, and optional UI components. It can help with app launching, web search, reminders, messaging workflows, file handling, vision-based tasks, and other assistant-style actions through the modules in this repository.

## What it does

- Voice-driven assistant loop with live interaction
- Tool-based automation for desktop and browser tasks
- Memory persistence and backups
- Optional semantic search and retrieval support
- Optional passive vision and screen processing
- Optional integrations for Gmail, VS Code, Telegram, Discord, and Obsidian
- React/Vite desktop UI under `UI/`

## Repository Layout

- `main.py` - main application entry point
- `ui.py` - legacy compatibility shim for shared UI theme imports
- `core/` - core assistant logic, memory, monitoring, safety, and integrations
- `actions/` - action handlers for specific tasks like browser, files, weather, and messaging
- `memory/` - memory management, backups, and long-term storage helpers
- `config/` - configuration loading and integration settings
- `docs/` - setup and feature documentation
- `UI/` - React/Vite frontend and bundled desktop UI assets
- `tests/` - automated tests for selected subsystems

## Requirements

- Python 3.11+
- A Gemini API key
- Optional: microphone and speakers for voice mode
- Optional: Playwright browsers for browser automation

Some features rely on platform-specific packages or integrations, so not every module will be available in every environment.

## Setup

1. Create a virtual environment:

```bash
python -m venv venv
```

2. Activate it:

```bash
venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Install Playwright browsers:

```bash
python -m playwright install
```

5. Create your local config file:

```bash
copy .env.example .env
```

6. Add your API key and any optional integrations to `.env`.

## Configuration

The project uses `.env` for runtime configuration. The example file contains the supported variables, including:

- `GEMINI_API_KEY`
- `LIVE_MODEL`
- `TEXT_MODEL`
- `VISION_MODEL`
- `OLLAMA_ENABLED`
- `PASSIVE_VISION_ENABLED`
- `RAG_ENABLED`
- `HUD_ENABLED`
- `PROACTIVE_SUGGESTIONS_ENABLED`
- `VSCODE_BRIDGE_ENABLED`
- `GMAIL_ENABLED`
- `OBSIDIAN_ENABLED`

See `.env.example` for the full list and default values.

## Run

```bash
.\venv\Scripts\python.exe .\main.py
```

The assistant will start its UI and wait for the configured API key before launching the main runtime.

## Optional UI Workspace

The `UI/` folder is the React frontend workspace.

```bash
cd UI
npm install
npm run dev
```

## Development Notes

- Do not commit `.env`, local caches, logs, or virtual environments.
- The repository already includes a `.gitignore` for common local artifacts.
- `setup.py` can also be used to install dependencies and Playwright browsers automatically.

## Tests

Run the test suite with:

```bash
pytest
```

## License

No explicit license is defined in this repository yet. Add one before publishing or sharing broadly.
