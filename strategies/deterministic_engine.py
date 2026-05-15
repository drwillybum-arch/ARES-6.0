import os
from .funding_arb import funding_arb_signal
from .trend_following import trend_signal

class DeterministicEngine:
    def __init__(self):
        self.enable_funding = os.getenv("ENABLE_FUNDING_ARB", "true").lower() == "true"
        self.enable_trend = os.getenv("ENABLE_TREND_FOLLOWING", "false").lower() == "true"

    async def decide(self):
        if self.enable_funding:
            arb = await funding_arb_signal()
            if arb["action"] != "hold":
                return arb

        if self.enable_trend:
            tf = trend_signal()
            if tf["action"] != "hold":
                return tf

        return {"action": "hold"}
