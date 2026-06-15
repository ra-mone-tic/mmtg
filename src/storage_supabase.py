"""
MeowAfisha · src/storage_supabase.py
Загрузка/удаление изображений в Supabase Storage и upsert событий через supabase-py.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from supabase import create_client, Client

from .config import SUPABASE_URL, SUPABASE_SERVICE_KEY

logger = logging.getLogger(__name__)

# ─── Клиент (service_role — bypass RLS) ──────────────

_supabase: Client | None = None


def _get_client() -> Client | None:
    global _supabase
    if _supabase is not None:
        return _supabase
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase не настроен — storage недоступен")
        return None
    _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase


BUCKET = "event-images"


# ─── Storage ─────────────────────────────────────────


def upload_event_image(event_id: str, image_data: bytes, content_type: str = "image/jpeg") -> str | None:
    """
    Загружает изображение в бакет event-images и возвращает публичный URL.
    Если файл уже существует — перезаписывает.
    """
    client = _get_client()
    if not client:
        return None

    file_path = f"{event_id}.jpg"

    try:
        # Пытаемся удалить старый файл (если есть)
        try:
            client.storage.from_(BUCKET).remove([file_path])
        except Exception:
            pass  # файла не было — ок

        # Загружаем
        client.storage.from_(BUCKET).upload(
            path=file_path,
            file=image_data,
            file_options={"content-type": content_type},
        )
        logger.info(f"Загружено изображение в Storage: {file_path}")
    except Exception as e:
        logger.error(f"Ошибка загрузки {file_path} в Storage: {e}")
        return None

    # Публичный URL
    public_url = client.storage.from_(BUCKET).get_public_url(file_path)
    return public_url


def delete_event_image(event_id: str) -> None:
    """Удаляет изображение из Storage."""
    client = _get_client()
    if not client:
        return

    file_path = f"{event_id}.jpg"
    try:
        client.storage.from_(BUCKET).remove([file_path])
        logger.info(f"Удалено изображение из Storage: {file_path}")
    except Exception as e:
        logger.warning(f"Не удалось удалить {file_path} из Storage: {e}")


# ─── Events upsert ───────────────────────────────────


def upsert_event(event: Dict[str, Any]) -> dict:
    """
    Вставляет или обновляет событие в таблицу events через service_role.
    Возвращает {"upserted": 1} или {"error": "..."}.
    """
    client = _get_client()
    if not client:
        return {"error": "Supabase не настроен"}

    # Маппинг полей (соответствует схеме БД)
    tags = event.get("tags", [])
    if isinstance(tags, str):
        tags = [tags] if tags else []

    db = event.get("description_blocks", [])
    if isinstance(db, list) and db and isinstance(db[0], list):
        db = [item for sub in db if isinstance(sub, list) for item in sub]

    data = {
        "id": event.get("id", ""),
        "date": event.get("date", ""),
        "title": event.get("title", ""),
        "location": event.get("location") or event.get("venue", ""),
        "address": event.get("address") or event.get("location", ""),
        "time": event.get("time", ""),
        "tags": tags,
        "short_description": event.get("short_description", ""),
        "full_description": event.get("full_description", ""),
        "description_blocks": db,
        "contacts": event.get("contacts", ""),
        "lat": event.get("lat"),
        "lon": event.get("lon"),
        "image_url": event.get("imageUrl") or event.get("image_url") or "",
        "tg_message_id": event.get("tg_message_id"),
        "is_active": event.get("is_active", True),
    }

    try:
        client.table("events").upsert(data, on_conflict="id").execute()
        logger.info(f"Upsert события {data['id']}: {data['title']}")
        return {"upserted": 1}
    except Exception as e:
        logger.error(f"Ошибка upsert события {data['id']}: {e}")
        return {"error": str(e)}