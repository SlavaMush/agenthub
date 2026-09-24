"""Telegram transport — modern UX.

Layout:
- Persistent reply keyboard with quick actions (always visible at the bottom)
- Inline buttons on trades/cards for one-tap actions
- Status card on /start that shows wallet, limits, positions summary
- /connect, /positions, /pause, /resume all still work as slash commands

All trading logic lives in bot/core.py. This file is presentation only.
"""
import logging

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    Update,
)
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from .core import (
    chat,
    execute_pending,
    get_user_by_telegram,
    pause_user,
    resume_user,
)
from .connect import get_or_create_session, new_session
from .config import CONNECT_WEB_URL
from .executor import Executor

log = logging.getLogger("veranta-bot.tg")

# ---------- Keyboards ----------

MAIN_KEYBOARD = ReplyKeyboardMarkup(
    [
        [KeyboardButton("📊 Positions"), KeyboardButton("⚙️ Settings")],
        [KeyboardButton("⏸ Pause"), KeyboardButton("▶️ Resume")],
        [KeyboardButton("🔗 Connect wallet"), KeyboardButton("ℹ️ Help")],
    ],
    resize_keyboard=True,
    is_persistent=True,
)


def _connect_inline(tg_id: str) -> InlineKeyboardMarkup:
    s = get_or_create_session(tg_id)
    url = f"{CONNECT_WEB_URL}?sid={s.sid}"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔗 Open connect page", url=url)],
        [InlineKeyboardButton("🔄 Generate new link", callback_data="connect:new")],
    ])


def _trade_confirm_kb(token: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Execute", callback_data=f"t:{token}"),
        InlineKeyboardButton("✖️ Cancel", callback_data="t:cancel"),
    ]])


def _quote_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 View positions", callback_data="nav:positions")],
        [InlineKeyboardButton("⚙️ Adjust limits", callback_data="nav:settings")],
    ])


# ---------- UI copy ----------

WELCOME_NEW = (
    "*Welcome to AgentHub*\n\n"
    "I execute perp trades on Base for you. You set the limits, I stay inside them.\n\n"
    "*To get started:*\n"
    "1. Connect your wallet (one click below)\n"
    "2. Sign one delegation — covers 30 days, no gas on your side\n"
    "3. Type trades in plain English\n\n"
    "*Protocol note:* ETH pair minimum is 100 USDC *notional* (size × price). "
    "Set your per-trade cap ≥ 100 USDC to trade it.\n\n"
    "_Examples:_\n"
    "  • `long $100 ETH 5x with a 10\\% stop`\n"
    "  • `long $30 BTC 4x` (30×4 = 120 notional)\n"
    "  • `close everything`"
)

WELCOME_BACK = """*👋 Welcome back*

Wallet: `{wallet}`
Limits: `{lev}x` max · `{size} USDC`/trade · `{daily} USDC`/day
Status: {status}

Type a trade or use the buttons below."""


# ---------- Handlers ----------

async def _reply_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    tg_id = str(update.effective_user.id)
    user, policy = get_user_by_telegram(tg_id)
    if user and user.wallet_address and policy:
        status = "⏸ Paused" if policy.paused else "✅ Active"
        await update.message.reply_text(
            WELCOME_BACK.format(
                wallet=user.wallet_address,
                lev=f"{policy.max_leverage:g}",
                size=f"{policy.max_collateral_per_trade:g}",
                daily=f"{policy.max_notional_per_day:g}",
                status=status,
            ),
            parse_mode="Markdown",
            reply_markup=MAIN_KEYBOARD,
        )
        return
    await update.message.reply_text(
        WELCOME_NEW,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🔗 Connect wallet (opens browser)", url=f"{CONNECT_WEB_URL}?sid={get_or_create_session(tg_id).sid}")],
        ]),
    )
    await update.message.reply_text("After you connect, I'll see your wallet here.", reply_markup=MAIN_KEYBOARD)


async def _show_positions(update_or_query, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    user, _ = get_user_by_telegram(str(update_or_query.effective_user.id))
    send = (update_or_query.message.reply_text if hasattr(update_or_query, "message") and update_or_query.message
            else update_or_query.edit_message_text)
    if not user:
        await send("Connect your wallet first. Tap 🔗 from the menu.")
        return
    executor: Executor = ctx.application.bot_data["executor"]
    try:
        data = await executor.positions(trader=user.wallet_address)
    except Exception as e:
        await send(f"Positions fetch failed: {type(e).__name__}")
        return
    if not data.positions:
        await send("📭 No open positions.", reply_markup=_quote_kb())
        return
    lines = ["*Your positions:*", ""]
    for p in data.positions:
        lines.append(
            f"• `{p.side.upper()} pair#{p.pair_index}` — "
            f"`{float(p.collateral):g}` USDC @ `{float(p.open_price):g}`\n"
            f"    liq `{float(p.liquidation_price):g}`"
        )
    lines.append(f"\n_Close with:_ `close everything`")
    await send("\n".join(lines), parse_mode="Markdown",
             reply_markup=InlineKeyboardMarkup([[
                 InlineKeyboardButton("✖️ Close all", callback_data="act:closeall"),
             ]]))


async def _show_settings(update_or_query, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    user, policy = get_user_by_telegram(str(update_or_query.effective_user.id))
    send = (update_or_query.message.reply_text if hasattr(update_or_query, "message") and update_or_query.message
            else update_or_query.edit_message_text)
    if not user or not policy:
        await send("Connect your wallet first.")
        return
    status = "⏸ Paused" if policy.paused else "✅ Active"
    text = (
        f"*Policy*\n\n"
        f"Status: {status}\n"
        f"Max leverage: `{policy.max_leverage:g}x`\n"
        f"Per-trade cap: `{policy.max_collateral_per_trade:g}` USDC\n"
        f"Daily cap: `{policy.max_notional_per_day:g}` USDC\n"
        f"Max open positions: `{policy.max_open_positions}`\n"
        f"Daily loss limit: `{policy.daily_loss_limit:g}` USDC\n\n"
        f"_Adjust on the site at agenthub.gg/start_"
    )
    await send(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup([[
        InlineKeyboardButton("⏸ Pause" if not policy.paused else "▶️ Resume",
                             callback_data="act:pause" if not policy.paused else "act:resume"),
        InlineKeyboardButton("🔒 Edit on site", url="https://agenthub.gg/start"),
    ]]))


async def _show_help(update_or_query, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    send = (update_or_query.message.reply_text if hasattr(update_or_query, "message") and update_or_query.message
            else update_or_query.edit_message_text)
    text = (
        "*How to trade*\n\n"
        "Just type it. Examples:\n"
        "  • `long $100 ETH 5x`\n"
        "  • `long $100 ETH 5x with a 10% stop`\n"
        "  • `short $50 BTC 3x`\n"
        "  • `close my ETH`\n"
        "  • `close everything`\n\n"
        "*Commands*\n"
        "/start — onboarding / status card\n"
        "/positions — open positions\n"
        "/pause — stop trading (closes still allowed)\n"
        "/resume — re-enable\n"
        "/connect — re-issue a wallet link"
    )
    await send(text, parse_mode="Markdown")


async def cmd_start(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await _reply_start(upd, ctx)


async def cmd_connect(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    tg_id = str(upd.effective_user.id)
    await upd.message.reply_text(
        "Open this page and sign the delegation so I can trade for you:",
        reply_markup=_connect_inline(tg_id),
    )


async def cmd_positions(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await _show_positions(upd, ctx)


async def cmd_pause(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    user, _ = get_user_by_telegram(str(upd.effective_user.id))
    if user:
        pause_user(user)
    await upd.message.reply_text("⏸ Trading paused. Closes still work. /resume to re-enable.",
                                  reply_markup=MAIN_KEYBOARD)


async def cmd_resume(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    user, _ = get_user_by_telegram(str(upd.effective_user.id))
    if user:
        resume_user(user)
    await upd.message.reply_text("▶️ Trading resumed.", reply_markup=MAIN_KEYBOARD)


async def on_message(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    text = (upd.message.text or "").strip()
    tg_id = str(upd.effective_user.id)

    # Menu-keyboard shortcuts
    if text == "📊 Positions":
        await _show_positions(upd, ctx)
        return
    if text == "⚙️ Settings":
        await _show_settings(upd, ctx)
        return
    if text == "⏸ Pause":
        user, _ = get_user_by_telegram(tg_id)
        if user:
            pause_user(user)
        await upd.message.reply_text("⏸ Trading paused.")
        return
    if text == "▶️ Resume":
        user, _ = get_user_by_telegram(tg_id)
        if user:
            resume_user(user)
        await upd.message.reply_text("▶️ Resumed.")
        return
    if text == "🔗 Connect wallet":
        await cmd_connect(upd, ctx)
        return
    if text == "ℹ️ Help":
        await _show_help(upd, ctx)
        return

    if text.lower().startswith("0x") and len(text) == 42:
        await upd.message.reply_text(
            "I don't link wallets by paste. Tap `</connect>` to sign the delegation.",
            parse_mode="Markdown",
        )
        return

    user, policy = get_user_by_telegram(tg_id)
    if not user or not policy:
        await upd.message.reply_text(
            "Connect your wallet first. Tap the button:",
            reply_markup=_connect_inline(tg_id),
        )
        return

    result = await chat(text, user, policy)
    if result.token:
        await upd.message.reply_text(
            result.reply, reply_markup=_trade_confirm_kb(result.token),
        )
    else:
        await upd.message.reply_text(result.reply)


async def on_callback(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    q = upd.callback_query
    await q.answer()
    data = q.data or ""
    tg_id = str(upd.effective_user.id)

    if data == "t:cancel":
        await q.edit_message_text("Cancelled.")
        return
    if data.startswith("t:"):
        token = data[2:]
        user, _ = get_user_by_telegram(tg_id)
        if not user:
            await q.edit_message_text("No linked wallet.")
            return
        executor: Executor = ctx.application.bot_data["executor"]
        res = await execute_pending(token, user, executor)
        body = res.reply if not res.tx else f"{res.reply}\n\nTx: `{res.tx}`"
        await q.edit_message_text(body, parse_mode="Markdown")
        return

    if data == "connect:new":
        s = new_session(tg_id)
        url = f"{CONNECT_WEB_URL}?sid={s.sid}"
        await q.edit_message_text(
            "Fresh connect link (other one is now invalid):",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔗 Open connect page", url=url)],
                [InlineKeyboardButton("🔄 Generate another", callback_data="connect:new")],
            ]),
        )
        return

    if data == "nav:positions":
        await _show_positions(upd, ctx)
        return
    if data == "nav:settings":
        await _show_settings(upd, ctx)
        return

    if data == "act:closeall":
        user, policy = get_user_by_telegram(tg_id)
        if not user or not policy:
            await q.edit_message_text("No linked wallet.")
            return
        res = await chat("close everything", user, policy)
        if res.token:
            await q.edit_message_text(
                res.reply, reply_markup=_trade_confirm_kb(res.token),
            )
        else:
            await q.edit_message_text(res.reply)
        return

    if data == "act:pause":
        user, _ = get_user_by_telegram(tg_id)
        if user:
            pause_user(user)
        await q.edit_message_text("⏸ Trading paused.")
        return
    if data == "act:resume":
        user, _ = get_user_by_telegram(tg_id)
        if user:
            resume_user(user)
        await q.edit_message_text("▶️ Resumed.")
        return


def build_app(token: str, executor: Executor) -> Application:
    app = Application.builder().token(token).build()
    app.bot_data["executor"] = executor
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("connect", cmd_connect))
    app.add_handler(CommandHandler("positions", cmd_positions))
    app.add_handler(CommandHandler("pause", cmd_pause))
    app.add_handler(CommandHandler("resume", cmd_resume))
    app.add_handler(CommandHandler("help", lambda u, c: _show_help(u, c)))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    return app
