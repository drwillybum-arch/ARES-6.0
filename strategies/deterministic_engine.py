import os
from .funding_arb import funding_arb_signal
from .trend_following import trend_signal

class DeterministicEngine:
    def __init__(self):
        self.enable_funding = os.getenv("ENABLE_FUNDING_ARB", "false").lower() == "true"
        self.enable_trend = os.getenv("ENABLE_TREND_FOLLOWING", "true").lower() == "true"

    async def decide(self):
        # Professional setup prioritizes Trend Following
        if self.enable_trend:
            tf = await trend_signal()
            if tf["action"] != "hold":
                return tf

        if self.enable_funding:
            arb = await funding_arb_signal()
            if arb["action"] != "hold":
                return arb

        return {"action": "hold"}
