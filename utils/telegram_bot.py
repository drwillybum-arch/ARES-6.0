import os
import asyncio
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

class TelegramBot:
    def __init__(self):
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.user_id = os.getenv("TELEGRAM_USERID")
        self.app = None
        self.fund = None

    async def run(self, fund_instance):
        self.fund = fund_instance
        if not self.token:
            print("TELEGRAM_BOT_TOKEN not set. Telegram bot disabled.")
            return

        self.app = Application.builder().token(self.token).build()
        self.app.add_handler(CommandHandler("status", self.status_command))
        self.app.add_handler(CommandHandler("pause", self.pause_command))
        self.app.add_handler(CommandHandler("resume", self.resume_command))

        await self.app.initialize()
        await self.app.start()
        await self.app.updater.start_polling()

        # Keep running
        while True:
            await asyncio.sleep(1)

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if str(update.effective_user.id) != self.user_id:
            await update.message.reply_text("Unauthorized")
            return
        status = "paused" if self.fund.is_paused else "running"
        await update.message.reply_text(f"Hedge fund is {status}. Daily loss limit: {self.fund.daily_loss_limit}%")

    async def pause_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if str(update.effective_user.id) != self.user_id:
            await update.message.reply_text("Unauthorized")
            return
        self.fund.pause()
        await update.message.reply_text("Trading paused.")

    async def resume_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if str(update.effective_user.id) != self.user_id:
            await update.message.reply_text("Unauthorized")
            return
        self.fund.resume()
        await update.message.reply_text("Trading resumed.")

    async def send_message(self, text):
        if self.app and self.user_id:
            try:
                await self.app.bot.send_message(chat_id=self.user_id, text=text)
            except Exception as e:
                print(f"Failed to send Telegram message: {e}")
