"""Entrypoint: Telegram polling, the web API and the MCP server on one event loop."""
import asyncio
import logging
import os

import uvicorn
from aiohttp import web

from .api import make_app
from .db import PORT
from .mcp_server import mcp
from .telegram_app import build


async def run() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # silence per-poll request logs
    runner = web.AppRunner(make_app(), access_log=None)
    await runner.setup()
    await web.TCPSite(runner, "127.0.0.1", PORT).start()
    mcp_http = uvicorn.Server(uvicorn.Config(mcp.streamable_http_app(), host="127.0.0.1", port=PORT + 1, log_level="warning"))
    mcp_task = asyncio.create_task(mcp_http.serve())
    async with build(os.environ["TELEGRAM_BOT_TOKEN"]) as tg:
        await tg.start()
        await tg.updater.start_polling(drop_pending_updates=True)
        logging.info("AgentHub up: API on 127.0.0.1:%s, MCP on :%s, Telegram polling", PORT, PORT + 1)
        await mcp_task  # runs until shutdown


if __name__ == "__main__":
    asyncio.run(run())
