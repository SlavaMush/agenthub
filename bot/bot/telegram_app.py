"""Telegram front-end. Presentation only: trading goes through core, onboarding through the web app."""
from telegram import InlineKeyboardButton as Btn, InlineKeyboardMarkup as Inline, ReplyKeyboardMarkup, Update
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters

from . import core
from .db import WEB_URL, get_user, sign_token

MENU = ReplyKeyboardMarkup([["Positions", "Limits"], ["Pause", "Resume"], ["Connect wallet", "Help"]], resize_keyboard=True)


def connect_button(tg_id: int) -> Inline:
    return Inline([[Btn("Connect wallet", url=f"{WEB_URL}/?tg={sign_token(f'tg-{tg_id}', 900)}")]])


async def on_text(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    msg, tg_id = upd.effective_message, upd.effective_user.id
    text = (msg.text or "").strip()
    if text.startswith("/"):  # /pause@bot arg -> pause
        text = text[1:].split()[0].split("@")[0]
    cmd = text.lower()
    u = get_user(telegram_id=str(tg_id))
    if cmd in ("start", "connect", "connect wallet") or not u:
        head = f"Linked to {u.wallet}.\n" if u else "Welcome to AgentHub: perp trades on Base, inside limits you set.\n"
        return await msg.reply_text(head + "Open the link to connect your wallet and sign the delegation (valid 15 min).",
                                    reply_markup=connect_button(tg_id))
    if cmd == "help":
        return await msg.reply_text(core.HELP, reply_markup=MENU)
    if cmd == "limits":
        lim = f"{u.max_leverage:g}x · ${u.max_collateral:g}/trade · ${u.max_daily_notional:g}/day · " \
              f"{u.max_positions} positions · ${u.max_daily_loss:g} daily loss"
        return await msg.reply_text(f"{lim}\n{'Paused' if u.paused else 'Active'}. Edit at {WEB_URL}")
    if cmd == "positions":
        ps = await core.positions(u)
        lines = [f"{p['side']} {p['pair']} ${p['collateral']:g} {p['leverage']:g}x @ {p['entry']:,.2f} "
                 f"(liq {p['liq']:,.2f}, pnl {p['pnl']:+.2f})" for p in ps]
        return await msg.reply_text("\n".join(lines) or "No open positions.")
    reply, token = await core.chat(u, text)
    kb = Inline([[Btn("Execute", callback_data=f"c:{token}"), Btn("Cancel", callback_data="x")]]) if token else None
    await msg.reply_text(reply, reply_markup=kb or MENU)


async def on_button(upd: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    q = upd.callback_query
    await q.answer()
    u = get_user(telegram_id=str(q.from_user.id))
    if q.data == "x" or not u:
        return await q.edit_message_text("Cancelled.")
    await q.edit_message_text(f"{q.message.text}\n\nExecuting…")
    await q.edit_message_text(await core.confirm(u, q.data[2:]))


def build(token: str) -> Application:
    app = Application.builder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT, on_text))
    app.add_handler(CallbackQueryHandler(on_button))
    return app
