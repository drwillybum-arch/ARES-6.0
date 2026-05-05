import os
import json
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
from typing import List, Dict, Optional
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ARES_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "core"))
CONVERSATIONS_DIR = os.path.join(SCRIPT_DIR, "conversations")

class AresGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("ARES v6 - Advanced Legal Research OS")
        self.root.geometry("1600x950")
        self.root.configure(bg="#f4f7f6")

        # Core State
        self.matter = {
            "id": f"MATTER-{datetime.now().strftime('%M%S')}",
            "case_name": "New Research",
            "facts": "",
            "lexMemory": None
        }
        self.history: List[Dict] = []
        self.available_tools = []
        
        # Ensure conversations dir exists
        if not os.path.exists(CONVERSATIONS_DIR):
            os.makedirs(CONVERSATIONS_DIR)

        self.setup_styles()
        self.setup_ui()
        
        # Initial Boot
        threading.Thread(target=self.fetch_tools, daemon=True).start()
        self.refresh_conversation_list()
        
        # Auto-save on exit
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        
        self.log_message("System", "ARES v6 OS Booting... Memory initialized.", "system")

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TFrame", background="#f4f7f6")
        style.configure("TLabel", background="#f4f7f6", font=("Segoe UI", 10))
        style.configure("Header.TLabel", font=("Segoe UI", 12, "bold"))
        style.configure("Action.TButton", font=("Segoe UI", 10, "bold"))
        style.configure("Save.TButton", background="#28a745", foreground="white")

    def setup_ui(self):
        # Top Header (Summary & Info)
        header = ttk.Frame(self.root, height=60)
        header.pack(fill=tk.X, side=tk.TOP, padx=10, pady=5)
        
        self.title_label = ttk.Label(header, text=f"Active Matter: {self.matter['id']}", style="Header.TLabel")
        self.title_label.pack(side=tk.LEFT)
        
        self.provider_badge = ttk.Label(header, text="Waterfall: Ready", foreground="white", background="#007bff", padding=5)
        self.provider_badge.pack(side=tk.RIGHT, padx=5)

        # Main Paned Layout
        self.main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.main_paned.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        # --- Sidebar (Tabs) ---
        self.sidebar_frame = ttk.Frame(self.main_paned, width=450)
        self.main_paned.add(self.sidebar_frame, weight=1)

        self.side_tabs = ttk.Notebook(self.sidebar_frame)
        self.side_tabs.pack(fill=tk.BOTH, expand=True)

        # Tab 1: Matter & Config
        self.setup_config_tab()
        
        # Tab 2: Conversations (History)
        self.setup_history_tab()

        # Tab 3: LexMemory
        self.setup_memory_tab()
        
        # Tab 4: Tools & Debate
        self.setup_tools_tab()

        # Tab 5: Logs (Shadows)
        self.setup_shadow_tab()

        # --- Center: Chat Area ---
        self.chat_frame = ttk.Frame(self.main_paned)
        self.main_paned.add(self.chat_frame, weight=3)

        # 1. Top Toolbar
        chat_toolbar = ttk.Frame(self.chat_frame)
        chat_toolbar.pack(fill=tk.X, side=tk.TOP, pady=5)
        ttk.Button(chat_toolbar, text="💾 Save Chat", command=self.save_conversation).pack(side=tk.LEFT, padx=5)
        ttk.Button(chat_toolbar, text="🧹 New Chat", command=self.new_conversation).pack(side=tk.LEFT, padx=5)

        # 2. Status Bar (Bottom)
        self.status_var = tk.StringVar(value="ARES Core Ready")
        self.status_bar = ttk.Label(self.chat_frame, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(fill=tk.X, side=tk.BOTTOM)

        # 3. Input Area (Above status bar)
        input_container = ttk.Frame(self.chat_frame)
        input_container.pack(fill=tk.X, side=tk.BOTTOM, pady=10, padx=5)

        self.user_input = ttk.Entry(input_container, font=("Segoe UI", 11))
        self.user_input.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        self.user_input.bind("<Return>", lambda e: self.send_message())

        self.send_btn = ttk.Button(input_container, text="SEND", style="Action.TButton", command=self.send_message)
        self.send_btn.pack(side=tk.RIGHT)

        # 4. Chat Display (Fill remaining)
        self.chat_display = scrolledtext.ScrolledText(self.chat_frame, state='disabled', wrap=tk.WORD, font=("Segoe UI", 11), bg="white", borderwidth=0)
        self.chat_display.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Tagging for colors
        self.chat_display.tag_configure("user", foreground="#0056b3", font=("Segoe UI", 11, "bold"))
        self.chat_display.tag_configure("ares", foreground="#1e7e34", font=("Segoe UI", 11, "bold"))
        self.chat_display.tag_configure("score", foreground="#6f42c1", font=("Segoe UI", 9, "italic"))
        self.chat_display.tag_configure("system", foreground="#6c757d", font=("Segoe UI", 9))
        self.chat_display.tag_configure("debate", foreground="#fd7e14", font=("Segoe UI", 10, "bold"))

    def setup_config_tab(self):
        f = ttk.Frame(self.side_tabs)
        self.side_tabs.add(f, text="Matter")
        
        ttk.Label(f, text="Case Facts / Record Summary:").pack(anchor=tk.W, padx=10, pady=(10, 0))
        self.facts_text = tk.Text(f, height=8, font=("Consolas", 10))
        self.facts_text.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(f, text="System Prompt Override:").pack(anchor=tk.W, padx=10, pady=(10, 0))
        self.system_prompt_text = tk.Text(f, height=8, font=("Consolas", 10))
        self.system_prompt_text.insert(tk.END, "You are ARES v6. Provide high-accuracy legal research. Always include a BOTTOM LINE.")
        self.system_prompt_text.pack(fill=tk.X, padx=10, pady=5)

        ttk.Label(f, text="ARES Mode:").pack(anchor=tk.W, padx=10)
        self.mode_var = tk.StringVar(value="STANDARD")
        ttk.Combobox(f, textvariable=self.mode_var, values=["LITE", "STANDARD", "DEEP"]).pack(fill=tk.X, padx=10, pady=5)

        ttk.Label(f, text="Procedural Posture:").pack(anchor=tk.W, padx=10)
        self.posture_var = tk.StringVar(value="pre-lit")
        ttk.Combobox(f, textvariable=self.posture_var, values=["pre-lit", "pleadings", "discovery", "msj", "trial", "appeal"]).pack(fill=tk.X, padx=10, pady=5)

        self.debate_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(f, text="Enable Multi-Agent Debate (MSJ/Appeal only)", variable=self.debate_var).pack(anchor=tk.W, padx=10, pady=10)

    def setup_history_tab(self):
        f = ttk.Frame(self.side_tabs)
        self.side_tabs.add(f, text="History")
        
        ttk.Label(f, text="Conversation History", font=("Helvetica", 10, "bold")).pack(pady=10)
        
        self.history_listbox = tk.Listbox(f, font=("Segoe UI", 9))
        self.history_listbox.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        self.history_listbox.bind("<<ListboxSelect>>", self.on_history_select)
        
        btn_frame = ttk.Frame(f)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(btn_frame, text="Refresh", command=self.refresh_conversation_list).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        ttk.Button(btn_frame, text="Load Selected", command=self.load_selected_conversation).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)

    def setup_memory_tab(self):
        f = ttk.Frame(self.side_tabs)
        self.side_tabs.add(f, text="LexMemory")
        self.memory_tree = ttk.Treeview(f, columns=("Kind", "Confirmed By", "Detail"), show="headings")
        self.memory_tree.heading("Kind", text="Kind")
        self.memory_tree.heading("Confirmed By", text="Conf")
        self.memory_tree.heading("Detail", text="Detail")
        self.memory_tree.column("Kind", width=70)
        self.memory_tree.column("Confirmed By", width=50)
        self.memory_tree.column("Detail", width=250)
        self.memory_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

    def setup_tools_tab(self):
        f = ttk.Frame(self.side_tabs)
        self.side_tabs.add(f, text="Tools")
        ttk.Label(f, text="Manual Tool Dispatch", font=("Helvetica", 10, "bold")).pack(pady=5)
        self.tool_selector = ttk.Combobox(f, values=[])
        self.tool_selector.pack(fill=tk.X, padx=10, pady=5)
        ttk.Label(f, text="Arguments (JSON):").pack(anchor=tk.W, padx=10)
        self.tool_args_text = tk.Text(f, height=5, font=("Consolas", 9))
        self.tool_args_text.insert(tk.END, '{"raw": "Smith v. Jones, 123 F.3d 456 (2020)"}')
        self.tool_args_text.pack(fill=tk.X, padx=10, pady=5)
        ttk.Button(f, text="Run Tool", command=self.run_manual_tool).pack(fill=tk.X, padx=10, pady=10)
        self.tool_result_display = scrolledtext.ScrolledText(f, height=15, font=("Consolas", 9), bg="#f8f9fa")
        self.tool_result_display.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

    def setup_shadow_tab(self):
        f = ttk.Frame(self.side_tabs)
        self.side_tabs.add(f, text="Logs")
        self.shadow_display = scrolledtext.ScrolledText(f, font=("Consolas", 9), bg="#1e1e1e", fg="#dcdcdc")
        self.shadow_display.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

    def log_message(self, role: str, text: str, tags=None):
        self.chat_display.configure(state='normal')
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = f"[{timestamp}] {role}: "
        self.chat_display.insert(tk.END, prefix, role.lower())
        self.chat_display.insert(tk.END, f"{text}\n\n", tags)
        self.chat_display.configure(state='disabled')
        self.chat_display.see(tk.END)

    def save_conversation(self):
        if not self.history: return
        filename = f"ares_chat_{self.matter['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(CONVERSATIONS_DIR, filename)
        
        data = {
            "matter": self.matter,
            "history": self.history,
            "timestamp": datetime.now().isoformat()
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        self.status_var.set(f"Chat saved to {filename}")
        self.refresh_conversation_list()

    def load_selected_conversation(self):
        selection = self.history_listbox.curselection()
        if not selection: return
        
        filename = self.history_listbox.get(selection[0])
        filepath = os.path.join(CONVERSATIONS_DIR, filename)
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            self.new_conversation(archive=False)
            self.matter = data.get("matter", self.matter)
            self.history = data.get("history", [])
            
            self.title_label.config(text=f"Active Matter: {self.matter['id']}")
            
            for msg in self.history:
                role = "User" if msg["role"] == "user" else "ARES"
                content = msg.get("content") or msg.get("parts", [{}])[0].get("text", "")
                self.log_message(role, content)
            
            if self.matter.get("lexMemory"):
                self.update_memory_ui(self.matter["lexMemory"])
            
            self.status_var.set(f"Loaded {filename}")
        except Exception as e:
            messagebox.showerror("Load Error", str(e))

    def new_conversation(self, archive=True):
        if archive: self.save_conversation()
        self.history = []
        self.matter = {
            "id": f"MATTER-{datetime.now().strftime('%M%S')}",
            "case_name": "New Research",
            "facts": "",
            "lexMemory": None
        }
        self.title_label.config(text=f"Active Matter: {self.matter['id']}")
        self.chat_display.configure(state='normal')
        self.chat_display.delete('1.0', tk.END)
        self.chat_display.configure(state='disabled')
        self.memory_tree.delete(*self.memory_tree.get_children())
        self.log_message("System", "Started a fresh conversation session.", "system")

    def refresh_conversation_list(self):
        self.history_listbox.delete(0, tk.END)
        files = sorted(os.listdir(CONVERSATIONS_DIR), reverse=True)
        for f in files:
            if f.endswith(".json"):
                self.history_listbox.insert(tk.END, f)

    def on_history_select(self, event):
        pass

    def on_close(self):
        self.save_conversation()
        self.root.destroy()

    def call_ares_bridge(self, action: str, payload: Dict) -> Optional[Dict]:
        try:
            input_data = json.dumps({"action": action, "payload": payload})
            my_env = os.environ.copy()
            # Suppress some common CLI chatter in the environment if possible
            my_env["DOTENVX_QUIET"] = "1"
            
            result = subprocess.run(
                ["npx", "ts-node", "ares-cli-bridge.ts"],
                input=input_data, 
                capture_output=True, 
                text=True, 
                cwd=ARES_DIR, 
                shell=True,
                env=my_env,
                encoding="utf-8",
                errors="replace"
            )
            
            stdout = (result.stdout or "")
            stderr = (result.stderr or "").strip()
            
            # Robust JSON extraction: Find all { and try to parse
            # We look for the most likely JSON block (usually the last or largest)
            json_start_indices = [i for i, char in enumerate(stdout) if char in ('{', '[')]
            json_end_indices = [i for i, char in enumerate(stdout) if char in ('}', ']')]
            
            # Try from longest to shortest to find the largest valid JSON block
            potential_blocks = []
            for start in json_start_indices:
                for end in json_end_indices:
                    if end > start:
                        potential_blocks.append(stdout[start:end+1])
            
            # Sort by length descending
            potential_blocks.sort(key=len, reverse=True)
            
            for block in potential_blocks:
                try:
                    return json.loads(block)
                except json.JSONDecodeError:
                    continue
            
            # If no JSON, check for errors in stdout/stderr
            err_msg = stderr if stderr else stdout.strip()
            if not err_msg:
                err_msg = f"Process exited with code {result.returncode} but produced no output."
                
            return {"error": f"ARES Bridge Error (No JSON found):\n{err_msg}"}
        except Exception as e:
            return {"error": f"Bridge Execution Error: {str(e)}"}

    def fetch_tools(self):
        res = self.call_ares_bridge("list_tools", {})
        if isinstance(res, list):
            self.available_tools = res
            self.tool_selector['values'] = [t['name'] for t in res]
            if res: self.tool_selector.current(0)

    def run_manual_tool(self):
        tool_name = self.tool_selector.get()
        try:
            args = json.loads(self.tool_args_text.get("1.0", tk.END).strip())
            threading.Thread(target=self._exec_tool, args=(tool_name, args), daemon=True).start()
        except Exception as e:
            messagebox.showerror("JSON Error", f"Invalid Arguments: {str(e)}")

    def _exec_tool(self, name, args):
        self.status_var.set(f"Running {name}...")
        res = self.call_ares_bridge("dispatch_tool", {"name": name, "args": args})
        self.root.after(0, lambda: self.show_tool_result(res))

    def show_tool_result(self, res):
        self.tool_result_display.insert(tk.END, f"\n--- {datetime.now().strftime('%H:%M:%S')} ---\n")
        self.tool_result_display.insert(tk.END, json.dumps(res, indent=2))
        self.tool_result_display.see(tk.END)
        self.status_var.set("ARES Ready")

    def send_message(self):
        text = self.user_input.get().strip()
        if not text: return
        self.user_input.delete(0, tk.END)
        self.log_message("User", text)
        self.history.append({"role": "user", "content": text})
        self.matter["facts"] = self.facts_text.get("1.0", tk.END).strip()
        self.send_btn.config(state=tk.DISABLED)
        self.status_var.set("ARES Pipeline Active...")
        threading.Thread(target=self.process_ares_flow, daemon=True).start()

    def process_ares_flow(self):
        try:
            sys_prompt = self.system_prompt_text.get("1.0", tk.END).strip()
            gen_payload = {
                "messages": self.history,
                "system": sys_prompt,
                "matter": self.matter,
                "posture": self.posture_var.get(),
                "use_debate": self.debate_var.get()
            }
            res = self.call_ares_bridge("generate", gen_payload)
            if "error" in res:
                self.root.after(0, lambda: self.handle_error(res["error"]))
                return

            text = res.get("text", "")
            shadow = res.get("shadow")
            debate = res.get("debate")
            self.matter["lexMemory"] = res.get("updatedMemory")
            provider = res.get("provider", "unknown")

            if debate and not debate.get("skipped"):
                self.root.after(0, lambda d=debate: self.log_message("Debate", d["reasoning"], "debate"))

            critic_payload = {
                "draft": text,
                "shadow": shadow,
                "mode": self.mode_var.get(),
                "posture": self.posture_var.get(),
                "matterId": self.matter["id"],
                "systemPrompt": sys_prompt
            }
            critic_res = self.call_ares_bridge("critic", critic_payload)
            
            final_text = text
            score_info = f"Provider: {provider}"
            if critic_res and "error" not in critic_res:
                score = critic_res.get("score", {})
                if critic_res.get("revised_draft"):
                    final_text = critic_res["revised_draft"]
                    score_info += f" | REVISED Score: {critic_res.get('revised_score', {}).get('overall', 0):.2f}"
                else:
                    score_info += f" | Score: {score.get('overall', 0):.2f}"
                notes = score.get("notes", [])
                if notes: score_info += f" | Notes: {', '.join(notes)}"

            self.history.append({"role": "assistant", "content": final_text})
            self.root.after(0, lambda: self.finalize_ui(final_text, score_info, shadow, provider))
        except Exception as e:
            self.root.after(0, lambda: self.handle_error(str(e)))

    def finalize_ui(self, text, score_info, shadow, provider):
        self.log_message("ARES", text)
        self.log_message("System", score_info, "score")
        self.provider_badge.config(text=f"Waterfall: {provider}")
        if shadow:
            self.shadow_display.delete('1.0', tk.END)
            self.shadow_display.insert(tk.END, json.dumps(shadow, indent=2))
        if self.matter["lexMemory"]:
            self.update_memory_ui(self.matter["lexMemory"])
        self.send_btn.config(state=tk.NORMAL)
        self.status_var.set("ARES Ready")

    def update_memory_ui(self, memory):
        self.memory_tree.delete(*self.memory_tree.get_children())
        for node in memory.get("nodes", []):
            self.memory_tree.insert("", tk.END, values=(node.get("kind"), ",".join(node.get("confirmedBy", [])), node.get("citation") or node.get("detail") or node.get("question")))

    def show_error_dialog(self, title, message):
        err_win = tk.Toplevel(self.root)
        err_win.title(title)
        err_win.geometry("800x600")
        err_win.configure(bg="#f4f7f6")
        err_win.transient(self.root)
        err_win.grab_set()

        lbl = ttk.Label(err_win, text=f"⚠️ {title}", font=("Segoe UI", 12, "bold"), foreground="#dc3545")
        lbl.pack(pady=10)

        txt = scrolledtext.ScrolledText(err_win, font=("Consolas", 10), bg="white")
        txt.insert(tk.END, message)
        txt.configure(state='disabled')
        txt.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        btn_frame = ttk.Frame(err_win)
        btn_frame.pack(fill=tk.X, pady=10)

        def copy_all():
            self.root.clipboard_clear()
            self.root.clipboard_append(message)
            self.status_var.set("Error text copied to clipboard")

        ttk.Button(btn_frame, text="📋 Copy All", command=copy_all).pack(side=tk.LEFT, padx=20)
        ttk.Button(btn_frame, text="Close", command=err_win.destroy).pack(side=tk.RIGHT, padx=20)

    def handle_error(self, err_msg):
        self.show_error_dialog("ARES Pipeline Error", err_msg)
        self.send_btn.config(state=tk.NORMAL)
        self.status_var.set("Error State")

if __name__ == "__main__":
    root = tk.Tk()
    app = AresGUI(root)
    root.mainloop()
