import os
import json
import datetime
from typing import List, Dict

from google import genai
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.prompt import Prompt
from rich.text import Text
from rich.theme import Theme

# Initialize Rich Console with a nice theme
custom_theme = Theme({
    "user": "bold cyan",
    "gemini": "bold green",
    "system": "bold yellow",
    "error": "bold red",
})
console = Console(theme=custom_theme)

# Load environment variables
load_dotenv()

# Configuration
# Waterfall order: tries best/most accurate models first, then falls back on failure
MODEL_WATERFALL = [
    "gemini-2.0-pro-exp-02-05",        # Highest accuracy/experimental
    "gemini-2.0-flash-thinking-exp-01-21", # High reasoning
    "gemini-1.5-pro",                  # Stable premium
    "gemini-2.0-flash"                 # Fastest/Reliable fallback
]
CONVERSATIONS_DIR = "conversations"

class GeminiChat:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables.")
        
        self.client = genai.Client(api_key=self.api_key)
        self.history: List[Dict] = []
        self.session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Ensure conversations directory exists
        if not os.path.exists(CONVERSATIONS_DIR):
            os.makedirs(CONVERSATIONS_DIR)

    def start_new_session(self):
        """Resets history and starts a fresh session."""
        self.history = []
        self.session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        console.print(Panel(Text("Started a new conversation session.", style="system")))

    def save_conversation(self):
        """Saves the current history to a JSON file."""
        if not self.history:
            return

        filename = f"chat_{self.session_id}.json"
        filepath = os.path.join(CONVERSATIONS_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.history, f, indent=2, ensure_ascii=False)
        
        console.print(f"[system]Conversation saved to {filepath}[/system]")

    def generate_with_waterfall(self):
        """Attempts to generate content using the model waterfall."""
        errors = []
        for model_name in MODEL_WATERFALL:
            try:
                with console.status(f"[gemini]Thinking ({model_name})...[/gemini]", spinner="dots"):
                    response = self.client.models.generate_content(
                        model=model_name,
                        contents=self.history
                    )
                return response.text, model_name
            except Exception as e:
                errors.append(f"{model_name}: {str(e)}")
                continue
        
        raise Exception("All waterfall models failed:\n" + "\n".join(errors))

    def chat_loop(self):
        """Main interaction loop."""
        console.print(Panel(
            Markdown(f"# Gemini CLI Chat (High-Accuracy Waterfall)\nPrimary Model: `{MODEL_WATERFALL[0]}`\n\nCommands:\n- `new`: Start fresh\n- `save`: Manual save\n- `exit`/`quit`: End session"),
            title="Welcome",
            border_style="blue"
        ))

        while True:
            try:
                user_input = Prompt.ask("\n[user]You[/user]")
                
                # Command handling
                cmd = user_input.strip().lower()
                if cmd in ["exit", "quit"]:
                    self.save_conversation()
                    console.print("[system]Goodbye![/system]")
                    break
                elif cmd == "new":
                    self.save_conversation()
                    self.start_new_session()
                    continue
                elif cmd == "save":
                    self.save_conversation()
                    continue
                
                if not user_input.strip():
                    continue

                # Prepare history for the API
                self.history.append({"role": "user", "parts": [{"text": user_input}]})

                # Call Gemini with waterfall
                response_text, used_model = self.generate_with_waterfall()
                
                self.history.append({"role": "model", "parts": [{"text": response_text}]})

                # Display response
                console.print(Panel(
                    Markdown(response_text), 
                    title=f"[gemini]Gemini ({used_model})[/gemini]", 
                    border_style="green"
                ))

            except Exception as e:
                console.print(f"[error]Error: {str(e)}[/error]")
                self.save_conversation()

if __name__ == "__main__":
    try:
        # You can set your API key here or via environment variable
        chat = GeminiChat()
        chat.chat_loop()
    except KeyboardInterrupt:
        console.print("\n[system]Interrupted by user. Exiting...[/system]")
    except Exception as e:
        console.print(f"[error]Fatal Error: {str(e)}[/error]")
