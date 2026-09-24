"""Entrypoint: runs the Telegram bot (long polling) plus the WalletConnect API."""
import asyncio
import logging
import os
import threading

from . import config
from .db import init_db
from .executor import Executor
from .telegram_app import build_app


def _run_connect_api(executor) -> None:
    from aiohttp import web
    from .connect import make_app
    from .agent_service import mount as mount_agent

    app = make_app()
    mount_agent(app, executor)

    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    async def go():
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host="127.0.0.1", port=config.CONNECT_API_PORT)
        await site.start()
        # Keep alive
        while True:
            await asyncio.sleep(3600)

    loop.run_until_complete(go())


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if not config.TELEGRAM_BOT_TOKEN:
        raise SystemExit("TELEGRAM_BOT_TOKEN not set")
    master = os.environ.get("VERANTA_CONNECT_MASTER_KEY", "")
    if not master:
        raise SystemExit("VERANTA_CONNECT_MASTER_KEY not set")

    init_db(config.DATABASE_URL)

    from .connect import decrypt_secret
    from .db import DelegateLink, get_session as tgdb
    from sqlmodel import select
    from .core import get_user_by_wallet

    def signer_resolver(trader: str) -> str:
        """Return the decrypted per-user delegate private key for this trader."""
        user, _ = get_user_by_wallet(trader)
        if not user:
            raise RuntimeError(f"no user for {trader}")
        with tgdb() as sess:
            dl = sess.exec(
                select(DelegateLink).where(DelegateLink.user_id == user.id)
            ).first()
            if not dl or not dl.active or not dl.encrypted_key_material:
                raise RuntimeError(f"no active delegate link for {trader}")
            return decrypt_secret(dl.encrypted_key_material, master)

    executor = Executor(
        private_key=None,
        network=config.NETWORK,
        builder_code=config.BUILDER_CODE,
        builder_fee_percent=config.BUILDER_FEE_PERCENT,
        signer_resolver=signer_resolver,
    )

    t = threading.Thread(target=_run_connect_api, args=(executor,), daemon=True)
    t.start()

    app = build_app(config.TELEGRAM_BOT_TOKEN, executor)
    print(f"Bot starting on {config.NETWORK}. Connect+Agent API on 127.0.0.1:{config.CONNECT_API_PORT}. Polling...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
