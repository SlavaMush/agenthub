"""Config: environment-driven settings."""
import os

from dotenv import load_dotenv

load_dotenv()

NETWORK = os.environ.get("VERANTA_NETWORK", "testnet")
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./bot.db")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
PLATFORM_DELEGATE_KEY = os.environ.get("VERANTA_PRIVATE_KEY", "")
BUILDER_CODE = os.environ.get("VERANTA_BUILDER_CODE") or None
BUILDER_FEE_PERCENT = (
    float(os.environ["VERANTA_BUILDER_FEE_PERCENT"])
    if os.environ.get("VERANTA_BUILDER_FEE_PERCENT")
    else None
)
CONNECT_WEB_URL = os.environ.get("CONNECT_WEB_URL", "https://agenthub.gg/connect")
CONNECT_API_PORT = int(os.environ.get("CONNECT_API_PORT", "8791"))
ONBOARD_URL = "https://delegate.veranta.xyz/"
CONFIRM_TTL_SECONDS = 300  # quote confirm links live 5 minutes
