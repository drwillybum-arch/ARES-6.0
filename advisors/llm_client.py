import os
import json
import glob
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

class LLMAdvisor:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "none").lower()
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")

        if self.provider == "openai" and self.api_key:
            self.client = AsyncOpenAI(api_key=self.api_key)
        elif self.provider == "anthropic" and self.api_key:
            self.client = AsyncAnthropic(api_key=self.api_key)
        else:
            self.client = None

        self.prompts = self._load_prompts()

    def _load_prompts(self):
        prompts = {}
        prompt_files = glob.glob("advisors/prompts/*.txt")
        for file_path in prompt_files:
            role = os.path.basename(file_path).replace(".txt", "")
            with open(file_path, "r") as f:
                prompts[role] = f.read()
        return prompts

    async def analyze(self, role=None, market_context=None, memory=None):
        """
        Hyper-efficient Agentic Analysis.
        Uses compressed JSON context and short-term memory.
        """
        if not self.client:
            return {"summary": "LLM offline", "sentiment": 0.0}

        selected_role = role if role in self.prompts else "macro_analyst"
        base_prompt = self.prompts.get(selected_role, "You are a quant advisor.")

        # Compressed prompt engineering
        prompt = f"""
        {base_prompt}
        MEM: {memory}
        CTX: {market_context}

        REQ: Analyze CTX+MEM. Output ONLY JSON:
        {{
            "summary": "...",
            "sentiment": float,
            "tuning": {{
                "atr_multiplier": float,
                "risk_pct": float,
                "breakout_window": int
            }}
        }}
        """

        try:
            if self.provider == "openai":
                resp = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                )
                return json.loads(resp.choices[0].message.content)
            elif self.provider == "anthropic":
                resp = await self.client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=1000,
                    messages=[{"role": "user", "content": prompt}]
                )
                import re
                match = re.search(r'\{.*\}', resp.content[0].text, re.DOTALL)
                if match:
                    return json.loads(match.group())
        except Exception as e:
            print(f"LLM error: {e}")
        return {"summary": "Error", "sentiment": 0.0}

    async def generate_daily_report(self, hourly_reports):
        if not self.client or not hourly_reports:
            return "No data."

        # Compress hourly reports into a list of summaries
        summary_list = [r.get('summary', '') for r in hourly_reports]
        prompt = f"Summarize these market events concisely:\n{json.dumps(summary_list)}"

        try:
            if self.provider == "openai":
                resp = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}]
                )
                return resp.choices[0].message.content
            elif self.provider == "anthropic":
                resp = await self.client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=1000,
                    messages=[{"role": "user", "content": prompt}]
                )
                return resp.content[0].text
        except: pass
        return "Daily summary failed."
