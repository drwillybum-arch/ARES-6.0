import os
import json
from datetime import datetime

class AgentMemory:
    """
    Implements Memory Architecture as per Dhivya Nagasubramanian (2026).
    - Short-term (Working): Current context and tool results.
    - Long-term (Episodic): Past events and outcomes (what worked/failed).
    - Long-term (Semantic): Verified facts and domain knowledge.
    """
    def __init__(self, data_dir=None):
        self.data_dir = data_dir or os.getenv("LOG_DIR", "/app/data")
        # In local dev, /app/data might not be writable
        if not os.path.exists(self.data_dir):
            try:
                os.makedirs(self.data_dir, exist_ok=True)
            except:
                self.data_dir = "data"
                os.makedirs(self.data_dir, exist_ok=True)

        self.episodic_file = os.path.join(self.data_dir, "memory_episodic.json")
        self.semantic_file = os.path.join(self.data_dir, "memory_semantic.json")

        self.episodic = self._load(self.episodic_file)
        self.semantic = self._load(self.semantic_file)
        self.working = {} # Volatile short-term memory

    def _load(self, filepath):
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    return json.load(f)
            except: pass
        return []

    def _save(self, data, filepath):
        try:
            with open(filepath, 'w') as f:
                json.dump(data, f)
        except: pass

    def add_episodic(self, event, outcome):
        """Record an event and its outcome for future reflection."""
        self.episodic.append({
            "event": event,
            "outcome": outcome,
            "timestamp": datetime.utcnow().isoformat()
        })
        # Keep last 100 episodes
        if len(self.episodic) > 100:
            self.episodic.pop(0)
        self._save(self.episodic, self.episodic_file)

    def add_semantic(self, fact):
        """Record a verified fact or domain knowledge."""
        if fact not in self.semantic:
            self.semantic.append(fact)
            self._save(self.semantic, self.semantic_file)

    def get_context_string(self):
        """Returns a compressed representation of memory for the LLM."""
        episodic_summary = [f"{e['event']}:{e['outcome']}" for e in self.episodic[-5:]]
        semantic_summary = self.semantic[-10:]

        return {
            "episodic": "|".join(episodic_summary) if episodic_summary else "None",
            "semantic": ";".join(semantic_summary) if semantic_summary else "None"
        }

    def clear_working(self):
        self.working = {}
