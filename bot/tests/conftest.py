"""Tests run against a throwaway SQLite file and a dummy master key."""
import os
import tempfile

os.environ["VERANTA_CONNECT_MASTER_KEY"] = "test-master-key"
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/t.db"
