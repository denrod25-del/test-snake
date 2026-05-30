"""Centralized paths and settings."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PLUGINS_DIR = ROOT / "plugins"
STATIC_DIR = Path(__file__).resolve().parent / "static"

DATA_DIR.mkdir(exist_ok=True)
PLUGINS_DIR.mkdir(exist_ok=True)

DEFAULT_DB_PATH = DATA_DIR / "searchlab.sqlite3"
