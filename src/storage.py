"""
MeowAfisha · src/storage.py
Чтение/запись JSON-файлов состояния и данных событий.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, List

from .config import OUTPUT_JSON, CACHE_FILE, STATE_FILE
from .storage_supabase import upsert_event

logger = logging.getLogger(__name__)


# ─── Низкоуровневые операции ─────────────────────────

def load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"Ошибка чтения {path.name}: {e}")
    return default


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ─── Geocache ────────────────────────────────────────

def load_geocache() -> dict:
    data = load_json(CACHE_FILE, {})
    if isinstance(data, dict):
        logger.info(f"Загружен кэш геокодинга: {len(data)} адресов")
        return data
    return {}


def save_geocache(cache: dict) -> None:
    clean = {
        k: v for k, v in cache.items()
        if isinstance(v, list) and len(v) == 2 and None not in v
    }
    save_json(CACHE_FILE, clean)
    logger.info(f"Кэш сохранён: {len(clean)} адресов")


# ─── State ───────────────────────────────────────────

def load_state() -> dict:
    data = load_json(STATE_FILE, {"last_update_id": 0})
    if not isinstance(data, dict):
        data = {"last_update_id": 0}
    data.setdefault("last_update_id", 0)
    return data


def save_state(state: dict) -> None:
    save_json(STATE_FILE, state)


# ─── Events ──────────────────────────────────────────

def load_existing_events() -> List[dict]:
    data = load_json(OUTPUT_JSON, [])
    return data if isinstance(data, list) else []


# save_events удалена — events.json больше не пишется парсером


# ─── Supabase sync ───────────────────────────────────

def sync_to_supabase(events: List[dict]) -> dict:
    """
    UPSERT events into Supabase events table via storage_supabase.upsert_event().
    Returns {"upserted": N} or {"error": "..."}.
    """
    if not events:
        return {"upserted": 0}

    count = 0
    for ev in events:
        result = upsert_event(ev)
        if result.get("error"):
            return {"error": result["error"]}
        count += 1

    logger.info(f"Supabase sync OK: {count} событий")
    return {"upserted": count}
