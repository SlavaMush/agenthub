#!/usr/bin/env sh
# Ship bot code to the VPS and restart. Uses the `agenthub` host alias from ~/.ssh/config.
set -e
cd "$(dirname "$0")/../bot"
tar czf - bot/__init__.py bot/db.py bot/core.py bot/account.py bot/api.py bot/x402pay.py bot/mcp_server.py bot/telegram_app.py bot/main.py requirements.txt | ssh agenthub '
  set -e; A=/home/agenthub/app
  tar xzf - -C $A && chown -R agenthub:agenthub $A/bot $A/requirements.txt
  sudo -u agenthub $A/venv/bin/pip install -q -r $A/requirements.txt
  systemctl restart agenthub && sleep 4 && systemctl is-active agenthub'
