#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
touch .env.e2e
./venv/bin/python scripts/e2e_testnet.py
