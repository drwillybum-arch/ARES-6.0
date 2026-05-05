import os
import json
import datetime
import subprocess
from typing import List, Dict, Optional

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.prompt import Prompt
from rich.text import Text
from rich.theme import Theme

# Initialize Rich Console
custom_theme = Theme({
    "user": "bold cyan",
    "gemini": "bold green",
    "system": "bold yellow",
    "ares": "bold magenta",
    "error": "bold red",
    "score": "bold blue",
    "provider": "bold white on blue",
})
console = Console(theme=custom_theme)

# Load environment variables
load_dotenv()

# Configuration
CONVERSATIONS_DIR = "conversations"
ARES_DIR = r"C:\Users\chris\OneDrive\Desktop\ARES"

class AresChat:
    def __init__(self):
        self.history: List[Dict] = []
        self.session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if not os.path.exists(CONVERSATIONS_DIR):
            os.makedirs(CONVERSATIONS_DIR)

    def start_new_session(self):
        self.history = []
        self.session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        console.print(Panel(Text("Started a new ARES session.", style="system")))

    def save_conversation(self):
        if not self.history: return
        filename = f"ares_chat_{self.session_id}.json"
        filepath = os.path.join(CONVERSATIONS_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.history, f, indent=2, ensure_ascii=False)
        console.print(f"[system]Conversation saved to {filepath}[/system]")

    def call_ares_bridge(self, action: str, payload: Dict) -> Optional[Dict]:
        """Generic caller for the ARES TS bridge."""
        try:
            # Prepare input JSON
            input_data = json.dumps({"action": action, "payload": payload})
            
            # Execute ts-node bridge
            result = subprocess.run(
                ["npx", "ts-node", "ares-cli-bridge.ts"],
                input=input_data,
                capture_output=True,
                text=True,
                cwd=ARES_DIR,
                shell=True
            )
            
            # Clean output: find the first { and last } to ignore chatter
            stdout = result.stdout.strip()
            start = stdout.find("{")
            end = stdout.rfind("}")
            
            if start == -1 or end == -1:
                err_msg = result.stderr or stdout
                console.print(f"[error]ARES Bridge Error (No JSON found): {err_msg}[/error]")
                return None
            
            json_str = stdout[start:end+1]
            return json.loads(json_str)
        except Exception as e:
            console.print(f"[error]ARES Bridge Call Failed: {str(e)}[/error]")
            return None

    def generate_with_ares_waterfall(self):
        """Generates content using the ARES multi-provider waterfall."""
        with console.status("[ares]ARES Waterfall Routing...[/ares]", spinner="earth"):
            # Map history to the format expected by ARES waterfall
            messages = []
            for h in self.history:
                messages.append({"role": h["role"], "content": h["parts"][0]["text"]})
            
            result = self.call_ares_bridge("generate", {
                "messages": messages,
                "model": "claude-haiku-4-5-20251001" # This triggers the ARES waterfall tiering
            })
            
            if not result:
                raise Exception("ARES Waterfall failed to return a response.")
            
            return result.get("text", ""), result.get("provider", "unknown")

    def chat_loop(self):
        console.print(Panel(
            Markdown(f"# ARES FULL WATERFALL\nRouting through: Mistral, Groq, Cerebras, Sambanova, OpenRouter, Nvidia, xAI, Gemini\n\nCommands:\n- `new`: Start fresh\n- `save`: Manual save\n- `exit`/`quit`: End session"),
            title="Welcome to ARES",
            border_style="magenta"
        ))

        while True:
            try:
                user_input = Prompt.ask("\n[user]You[/user]")
                
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
                
                if not user_input.strip(): continue

                self.history.append({"role": "user", "parts": [{"text": user_input}]})

                # Step 1: Generate Draft via ARES Waterfall (Groq, Mistral, etc.)
                draft_text, used_provider = self.generate_with_ares_waterfall()
                
                # Step 2: ARES Critic Evaluation
                ares_result = self.call_ares_bridge("critic", {"draft": draft_text})
                
                final_text = draft_text
                score_info = f"[provider]Provider: {used_provider}[/provider]"

                if ares_result:
                    score = ares_result.get("score", {})
                    overall = score.get("overall", 0)
                    passed = score.get("passed", False)
                    
                    if ares_result.get("revised_draft"):
                        final_text = ares_result["revised_draft"]
                        revised_score = ares_result.get("revised_score", {}).get("overall", 0)
                        score_info += f" | [score]Score: {overall:.2f} -> {revised_score:.2f} (REVISED)[/score]"
                    else:
                        score_info += f" | [score]Score: {overall:.2f} ({'PASSED' if passed else 'FAILED'})[/score]"
                    
                    notes = score.get("notes", [])
                    if notes:
                        score_info += "\n[system]Critic Notes:[/system] " + ", ".join(notes)

                self.history.append({"role": "model", "parts": [{"text": final_text}]})

                # Display final response
                console.print(Panel(
                    Markdown(final_text), 
                    title=f"[ares]ARES[/ares] | [provider]{used_provider}[/provider]", 
                    subtitle=score_info,
                    border_style="magenta"
                ))

            except Exception as e:
                console.print(f"[error]Error: {str(e)}[/error]")
                self.save_conversation()

if __name__ == "__main__":
    try:
        chat = AresChat()
        chat.chat_loop()
    except KeyboardInterrupt:
        console.print("\n[system]Interrupted by user. Exiting...[/system]")
    except Exception as e:
        console.print(f"[error]Fatal Error: {str(e)}[/error]")
