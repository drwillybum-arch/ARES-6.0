import os
import csv
from datetime import datetime

class HedgeFundLogger:
    def __init__(self):
        self.log_dir = os.getenv("LOG_DIR", "/app/data")
        # In local dev, /app/data might not be writable if not in docker
        if not os.path.exists(self.log_dir):
            try:
                os.makedirs(self.log_dir, exist_ok=True)
            except Exception:
                self.log_dir = "data"
                os.makedirs(self.log_dir, exist_ok=True)

        self.trade_log = os.path.join(self.log_dir, "trades.csv")
        self.advisor_log = os.path.join(self.log_dir, "advisor.csv")
        self._init_files()

    def _init_files(self):
        if not os.path.exists(self.trade_log):
            with open(self.trade_log, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["timestamp", "decision", "order_id", "status"])
        if not os.path.exists(self.advisor_log):
            with open(self.advisor_log, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["timestamp", "summary", "sentiment"])

    async def log_trade(self, decision, order):
        with open(self.trade_log, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([datetime.utcnow(), decision, order.get('order_id'), order.get('status')])

    async def log_hold(self, decision):
        # optionally log hold decisions
        pass

    async def log_advisor_report(self, report):
        with open(self.advisor_log, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([datetime.utcnow(), report.get('summary',''), report.get('sentiment','')])
