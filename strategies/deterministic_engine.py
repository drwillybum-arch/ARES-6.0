import os
from .funding_arb import funding_arb_signal
from .trend_following import trend_signal
from .order_flow import order_flow_signal

class DeterministicEngine:
    def __init__(self):
        self.enable_funding = os.getenv("ENABLE_FUNDING_ARB", "false").lower() == "true"
        self.enable_trend = os.getenv("ENABLE_TREND_FOLLOWING", "true").lower() == "true"
        self.enable_order_flow = os.getenv("ENABLE_ORDER_FLOW", "true").lower() == "true"

    async def decide(self, dynamic_params=None):
        # Professional setup: Trend + Order Flow Filter
        if self.enable_trend:
            tf = await trend_signal(dynamic_params)

            # If trend suggests a trade, filter it through Order Flow (OBI)
            if tf["action"] != "hold" and self.enable_order_flow:
                of = await order_flow_signal("BTC")
                # Only proceed if order flow confirms the trend direction
                if of["action"] == tf["action"]:
                    print(f"Trend {tf['action']} confirmed by OBI (conviction: {of['conviction']:.2f})")
                    return tf
                else:
                    print(f"Trend {tf['action']} REJECTED by OBI (obi action: {of['action']})")
                    return {"action": "hold", "reason": "OBI non-confirmation"}

            if tf["action"] != "hold":
                return tf

        if self.enable_funding:
            arb = await funding_arb_signal()
            if arb["action"] != "hold":
                return arb

        return {"action": "hold"}
