"""
MeowAfisha · src/storage.py
Чтение/запись JSON-файлов состояния и данных событий.
"""
from __future__ import annotations

import json
import logging
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, List

from .config import OUTPUT_JSON, CACHE_FILE, STATE_FILE, SUPABASE_URL, SUPABASE_SERVICE_KEY

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


def save_events(events: List[dict]) -> None:
    events.sort(key=lambda e: e.get("date", ""))
    save_json(OUTPUT_JSON, events)
    logger.info(f"Сохранено {len(events)} событий в events.json")


# ─── Supabase sync ───────────────────────────────────

def sync_to_supabase(events: List[dict]) -> dict:
    """
    UPSERT events into Supabase events table via REST API.
    Returns {"upserted": N} or {"error": "..."}.
    Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase не настроен — пропускаем синхронизацию")
        return {"skipped": True}

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/events"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Map events to Supabase schema
    rows = []
    for e in events:
        row = {
            "id":               e.get("id", ""),
            "date":             e.get("date", ""),
            "title":            e.get("title", ""),
            "location":         e.get("location") or e.get("venue", ""),
            "address":          e.get("address") or e.get("location", ""),
            "time":             e.get("time", ""),
            "tags":             e.get("tags", []),
            "short_description": e.get("short_description", ""),
            "full_description": e.get("full_description", ""),
            "description_blocks": e.get("description_blocks", []),
            "contacts":         e.get("contacts", ""),
            "lat":              e.get("lat"),
            "lon":              e.get("lon"),
            "image_url":        e.get("imageUrl") or e.get("image_url") or f"images/{e.get('id', '')}.jpg",
            "tg_message_id":    e.get("tg_message_id"),
            "is_active":        True,
        }
        rows.append(row)

    try:
        data = json.dumps(rows).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            body = resp.read().decode("utf-8", errors="replace")
            count = len(rows)
            logger.info(f"Supabase sync OK: {count} событий (status {status})")
            return {"upserted": count}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace") if e.fp else str(e)
        logger.error(f"Supabase sync error {e.code}: {err_body[:300]}")
        return {"error": f"HTTP {e.code}: {err_body[:200]}"}
    except Exception as e:
        logger.error(f"Supabase sync error: {e}")
        return {"error": str(e)}
