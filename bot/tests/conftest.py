"""Test fixtures — every test runs against an isolated in-memory SQLITE DB."""
import pytest


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch, tmp_path):
    from bot import db as dbmod
    url = f"sqlite:///{tmp_path}/t.db"
    dbmod.init_db(url)
    yield
