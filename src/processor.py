"""
MeowAfisha · src/processor.py
Обработка сообщений: парсинг, геокодирование, сборка событий, очистка.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .config       import IMAGES_DIR, BASE_DIR
from .utils        import parse_date
from .parser       import parse_post
from .geocoding    import geocode_address
from .telegram_api import get_file_url, download_image

logger = logging.getLogger(__name__)


# ─── ID события ─────────────────────────────────────

def make_event_id(date: str, title: str, location: str) -> str:
    source = f"{date}|{title}|{location}"
    return hashlib.md5(source.encode("utf-8")).hexdigest()[:12]


# ─── Общая сборка словаря события ───────────────────

def _build_event_dict(parsed: dict, msg_id: Optional[int], lat: float, lon: float) -> dict:
    """
    Единая точка сборки события из распарсенного поста.
    Используется и для одиночных сообщений, и для медиагрупп —
    устраняет дублирование кода.
    """
    return {
        "id"               : make_event_id(parsed["date"], parsed["title"], parsed["location"]),
        "date"             : parsed["date"],
        "title"            : parsed["title"],
        "location"         : parsed["address"],
        "address"          : parsed["address"],
        "time"             : parsed["time"],
        "tags"             : parsed["tags"],
        "short_description": parsed["short_description"],
        "full_description" : parsed["full_description"],
        "description_blocks": parsed.get("description_blocks", []),
        "contacts"         : parsed["contacts"],
        "lat"              : lat,
        "lon"              : lon,
        "tg_message_id"    : msg_id,
    }


def _attach_image(ev: dict, msg: dict) -> None:
    """Скачивает лучшее фото из сообщения и добавляет imageUrl в событие."""
    photos = msg.get("photo")
    if not isinstance(photos, list) or not photos:
        return
    best  = max(photos, key=lambda p: p.get("file_size", 0))
    url   = get_file_url(best["file_id"])
    if url:
        dest = IMAGES_DIR / f"{ev['id']}.jpg"
        if download_image(url, dest):
            ev["imageUrl"] = f"images/{dest.name}"


# ─── Одиночное сообщение ────────────────────────────

def process_single_message(msg: dict, geocache: dict) -> Optional[dict]:
    text = msg.get("text") or msg.get("caption") or ""
    if not text:
        return None

    entities = msg.get("entities") or msg.get("caption_entities") or []
    logger.info(f"Обработка msg_id={msg.get('message_id')}: {text[:200]!r}")

    parsed = parse_post(text, entities)
    if not parsed:
        logger.warning(f"Не удалось распарсить пост:\n{text[:500]}")
        return None

    lat, lon = geocode_address(parsed["location"], geocache)
    if lat is None:
        logger.warning(f"Не удалось геокодировать: {parsed['location']!r} — пропускаем")
        return None

    ev = _build_event_dict(parsed, msg.get("message_id"), lat, lon)
    _attach_image(ev, msg)
    logger.info(f"Обработано: {ev['title']} ({ev['date']}) @ {parsed['address']}")
    return ev


# ─── Медиагруппа ────────────────────────────────────

def process_media_group(msgs: List[dict], geocache: dict) -> Optional[dict]:
    # Находим сообщение с текстом и собираем все фото
    text_msg = next((m for m in msgs if m.get("caption")), msgs[0] if msgs else None)
    if not text_msg:
        return None

    text = text_msg.get("caption") or text_msg.get("text") or ""
    if not text:
        return None

    entities = text_msg.get("caption_entities") or text_msg.get("entities") or []
    parsed   = parse_post(text, entities)
    if not parsed:
        return None

    lat, lon = geocode_address(parsed["location"], geocache)
    if lat is None:
        logger.warning(f"Не удалось геокодировать (медиагруппа): {parsed['location']!r} — пропускаем")
        return None

    ev = _build_event_dict(parsed, text_msg.get("message_id"), lat, lon)

    # Лучшее фото из всех сообщений группы
    best_photo, best_size = None, 0
    for m in msgs:
        for ps in m.get("photo", []):
            if ps.get("file_size", 0) > best_size:
                best_size  = ps["file_size"]
                best_photo = ps

    if best_photo:
        url = get_file_url(best_photo["file_id"])
        if url:
            dest = IMAGES_DIR / f"{ev['id']}.jpg"
            if download_image(url, dest):
                ev["imageUrl"] = f"images/{dest.name}"

    logger.info(f"Обработана медиагруппа: {ev['title']} ({ev['date']})")
    return ev


# ─── Основная обработка пачки сообщений ─────────────

def process_messages(
    messages   : List[dict],
    existing   : List[dict],
    geocache   : dict,
) -> Tuple[List[dict], int, int]:
    events_by_id: Dict[str, dict] = {e["id"]: e for e in existing if e.get("id")}

    media_groups: Dict[str, List[dict]] = {}
    solo: List[dict] = []
    for msg in messages:
        mgid = msg.get("media_group_id")
        if mgid:
            media_groups.setdefault(mgid, []).append(msg)
        else:
            solo.append(msg)

    added = updated = 0

    def _upsert(ev: Optional[dict]) -> None:
        nonlocal added, updated
        if not ev:
            return
        eid = ev["id"]
        if eid in events_by_id:
            old_image = events_by_id[eid].get("imageUrl")
            events_by_id[eid].update(ev)
            # Сохраняем старую картинку, если новой нет
            if old_image and not events_by_id[eid].get("imageUrl"):
                events_by_id[eid]["imageUrl"] = old_image
            updated += 1
        else:
            events_by_id[eid] = ev
            added += 1

    for msg in solo:
        _upsert(process_single_message(msg, geocache))

    for group_msgs in media_groups.values():
        _upsert(process_media_group(group_msgs, geocache))

    logger.info(f"Обработано: добавлено {added}, обновлено {updated}")
    return list(events_by_id.values()), added, updated


# ─── Очистка старых афиш ────────────────────────────

def clean_old_posters(events_list: List[dict], threshold_days: int = 7) -> bool:
    """
    Удаляет файлы изображений и ссылки imageUrl для событий,
    прошедших более threshold_days назад.
    Возвращает True, если что-то было изменено.
    """
    changed  = False
    today    = datetime.now().date()
    deadline = today - timedelta(days=threshold_days)

    for ev in events_list:
        d = parse_date(ev.get("date", ""))
        if not d or d.date() > deadline:
            continue
        img = ev.get("imageUrl")
        if img:
            img_path = BASE_DIR / img
            try:
                if img_path.exists():
                    img_path.unlink()
                    logger.info(f"Удалена афиша: {img_path}")
            except Exception as e:
                logger.warning(f"Не удалось удалить {img_path}: {e}")
            ev.pop("imageUrl", None)
            changed = True

    return changed
