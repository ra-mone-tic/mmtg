"""
MeowAfisha · src/storage_supabase.py
Загрузка/удаление изображений в Supabase Storage и upsert событий через REST API.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict

import requests

from .config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from .utils  import session

logger = logging.getLogger(__name__)

BUCKET = "event-images"


def _headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }


def _storage_headers(content_type: str = "image/jpeg") -> dict:
    return {
        **_headers(),
        "Content-Type": content_type,
    }


# ─── Storage ─────────────────────────────────────────


def upload_event_image(event_id: str, image_data: bytes, content_type: str = "image/jpeg") -> str | None:
    """
    Загружает изображение в бакет event-images и возвращает публичный URL.
    Если файл уже существует — перезаписывает.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase не настроен — storage недоступен")
        return None

    base = SUPABASE_URL.rstrip("/")
    file_path = f"{event_id}.jpg"

    # 1. Удаляем старый файл (игнорируем ошибку — его может не быть)
    try:
        session.delete(
            f"{base}/storage/v1/object/{BUCKET}/{file_path}",
            headers=_headers(),
            timeout=15,
        )
    except Exception:
        pass

    # 2. Загружаем новый
    try:
        resp = session.post(
            f"{base}/storage/v1/object/{BUCKET}/{file_path}",
            headers=_storage_headers(content_type),
            data=image_data,
            timeout=30,
        )
        if resp.status_code not in (200, 201):
            logger.error(f"Ошибка загрузки изображения: HTTP {resp.status_code} {resp.text[:200]}")
            return None
        logger.info(f"Загружено изображение в Storage: {file_path}")
    except Exception as e:
        logger.error(f"Ошибка загрузки {file_path} в Storage: {e}")
        return None

    # 3. Публичный URL
    public_url = f"{base}/storage/v1/object/public/{BUCKET}/{file_path}"
    return public_url


def delete_event_image(event_id: str) -> None:
    """Удаляет изображение из Storage."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return

    base = SUPABASE_URL.rstrip("/")
    file_path = f"{event_id}.jpg"

    try:
        resp = session.delete(
            f"{base}/storage/v1/object/{BUCKET}/{file_path}",
            headers=_headers(),
            timeout=15,
        )
        if resp.status_code in (200, 204):
            logger.info(f"Удалено изображение из Storage: {file_path}")
        else:
            logger.warning(f"Не удалось удалить {file_path}: HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"Не удалось удалить {file_path} из Storage: {e}")


# ─── Events upsert ───────────────────────────────────


def _is_soft_deleted(event_id: str) -> bool:
    """
    Проверяет, есть ли в БД строка с таким ID и deleted_at IS NOT NULL.
    Возвращает True, если событие было мягко удалено.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False

    base = SUPABASE_URL.rstrip("/")
    try:
        resp = session.get(
            f"{base}/rest/v1/events?id=eq.{event_id}&select=deleted_at",
            headers=_headers(),
            timeout=15,
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows and len(rows) > 0:
                return rows[0].get("deleted_at") is not None
    except Exception as e:
        logger.warning(f"Не удалось проверить deleted_at для {event_id}: {e}")
    return False


def upsert_event(event: Dict[str, Any]) -> dict:
    """
    Вставляет или обновляет событие в таблицу events через REST API (service_role).
    Возвращает {"upserted": 1} или {"error": "..."}.

    Если событие было мягко удалено (deleted_at IS NOT NULL) — upsert НЕ выполняется,
    чтобы парсер из Telegram не восстановил удалённое событие.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return {"error": "Supabase не настроен"}

    event_id = event.get("id", "")

    # Проверяем, не было ли событие мягко удалено
    if _is_soft_deleted(event_id):
        logger.info(f"Событие {event_id} мягко удалено — пропускаем upsert")
        return {"skipped": 1, "reason": "soft_deleted"}

    base = SUPABASE_URL.rstrip("/")

    # Маппинг полей (соответствует схеме БД)
    tags = event.get("tags", [])
    if isinstance(tags, str):
        tags = [tags] if tags else []

    db = event.get("description_blocks", [])
    if isinstance(db, list) and db and isinstance(db[0], list):
        db = [item for sub in db if isinstance(sub, list) for item in sub]

    data = {
        "id": event_id,
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
        # is_active не передаётся — синхронизация из Telegram не должна
        # перезаписывать ручную деактивацию (см. manually_hidden в RLS)
    }

    try:
        resp = session.post(
            f"{base}/rest/v1/events",
            headers={
                **_headers(),
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            json=[data],
            timeout=30,
        )
        if resp.status_code in (200, 201):
            logger.info(f"Upsert события {data['id']}: {data['title']}")
            return {"upserted": 1}
        else:
            err = resp.text[:300]
            logger.error(f"Ошибка upsert события {data['id']}: HTTP {resp.status_code} {err}")
            return {"error": f"HTTP {resp.status_code}: {err}"}
    except Exception as e:
        logger.error(f"Ошибка upsert события {data['id']}: {e}")
        return {"error": str(e)}