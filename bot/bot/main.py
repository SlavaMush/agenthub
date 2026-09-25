"""Entrypoint: Telegram polling and the web API on one event loop."""
import asyncio
import logging
import os

from aiohttp import web

from .api import make_app
from .db import PORT
from .telegram_app import build


async def run() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # silence per-poll request logs
    runner = web.AppRunner(make_app(), access_log=None)
    await runner.setup()
    await web.TCPSite(runner, "127.0.0.1", PORT).start()
    async with build(os.environ["TELEGRAM_BOT_TOKEN"]) as tg:
        await tg.start()
        await tg.updater.start_polling(drop_pending_updates=True)
        logging.info("AgentHub up: API on 127.0.0.1:%s, Telegram polling", PORT)
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(run())
