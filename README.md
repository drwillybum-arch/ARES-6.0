# ARES OS: Advanced Research & Evaluation System (v6)

ARES OS is a high-accuracy, multi-agent desktop suite designed for complex legal research, strategy drafting, and procedural posture analysis. It bridges a TypeScript-based agentic core (ARES v6) with a modern Python/Tkinter Desktop GUI.

## 🚀 Key Features

*   **ARES Multi-Provider Waterfall**: Intelligent routing across Mistral, Groq (Llama-3.3), Cerebras, Gemini, and xAI. Automatically falls back to the next tier if a provider is down or rate-limited.
*   **LexMemory Graph**: A persistent, contextual memory system that tracks legal authorities, procedural facts, and strategy nodes in a graph structure.
*   **Evaluator-Optimizer Loop**: Every draft passes through an ARES Critic that scores accuracy, tone, and relevance, with auto-revision capabilities.
*   **Multi-Agent Debate**: Specialized mode for MSJ (Summary Judgment) and Appeals where agents "debate" the merits to predict outcomes and identify weaknesses.
*   **Integrated Toolbelt**: Real-time tools for citation verification (Bluebook), opinion lookup via CourtListener, and subsequent history detection.
*   **Desktop Research OS**: A tabbed GUI with real-time shadow log visualization, memory tree browsing, and historical conversation management.

## 🏗️ Architecture

### 1. The Python GUI (`ares_gui.py`)
Provides the user interface, manages local conversation history (`.json`), and orchestrates the bridge calls.
*   **Matter Management**: Track case-specific facts and procedural posture.
*   **Conversation Browser**: Save and load previous research sessions.

### 2. The TypeScript Bridge (`ares-cli-bridge.ts`)
A unified entry point that connects the Python environment to the ARES v6 engine.
*   Handles `generate`, `critic`, `debate`, and `tool_dispatch` actions.
*   Uses `ts-node` for seamless execution of the ARES library.

### 3. The ARES Core (TS Library)
The engine residing in `C:\Users\chris\OneDrive\Desktop\ARES`.
*   **Waterfall**: Logic for provider priority and mapping.
*   **LexMemory**: The "Bootstrap -> Merge -> Build Context" lifecycle.

## 🛠️ Installation

### Prerequisites
*   **Node.js** (v18+)
*   **Python** (v3.10+)
*   **Environment Variables**: An `.env` file in the `ARES` directory containing API keys (GROQ_API_KEY, MISTRAL_API_KEY, etc.).

### Setup
1.  **Clone the Repository**:
    ```bash
    git clone [your-repo-link]
    cd ares-os
    ```
2.  **Install Python Dependencies**:
    ```bash
    pip install python-dotenv
    ```
3.  **Install ARES Dependencies**:
    ```bash
    cd [ARES_DIRECTORY_PATH]
    npm install
    ```

## 🖥️ Usage

Run the Desktop GUI:
```bash
python ares_gui.py
```

### GUI Tabs:
*   **Matter**: Configure case facts, ARES mode (Lite/Standard/Deep), and system prompts.
*   **History**: Load previous conversations.
*   **LexMemory**: Browse the live memory graph of confirmed legal nodes.
*   **Tools**: Manually run citation verification or lookup tools.
*   **Logs**: View the "Shadow" JSON logs of the agent's internal reasoning.

## 🛡️ Security
*   **Local Storage**: Conversations are stored locally as JSON.
*   **Bridge Security**: Data is passed via standard input/output; no local ports are opened.
*   **Credential Protection**: All API keys are managed through the ARES `.env` and are never logged or committed.

## 📜 License
[Your License Choice]
