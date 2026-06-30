"""
MeowAfisha · src/processor.py
Обработка сообщений: парсинг, геокодирование, сборка событий, очистка.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .config       import BASE_DIR
from .parser       import parse_post
from .geocoding    import geocode_address
from .telegram_api import get_file_url
from .storage_supabase import upload_event_image

logger = logging.getLogger(__name__)


# ─── Загрузка справочника мест ─────────────────────────

def _load_places() -> List[dict]:
    """Загружает places.json и возвращает список мест."""
    places_path = BASE_DIR / "places.json"
    if not places_path.exists():
        logger.warning("places.json не найден")
        return []
    try:
        with open(places_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Ошибка загрузки places.json: {e}")
        return []


def _normalize(s: str) -> str:
    """Приводит строку к нижнему регистру, убирает лишние пробелы и знаки."""
    s = s.lower().strip()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _extract_street(address: str) -> str:
    """Извлекает номер улицы/дома из адреса для сопоставления."""
    # Ищем паттерн "улица/проспект/бульвар ... номер"
    addr = address.strip().rstrip(".")
    # Берём последнюю значимую часть адреса — обычно это улица + дом
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if not parts:
        return ""
    # Пробуем взять часть с номером дома (содержит цифры)
    for part in reversed(parts):
        if re.search(r"\d", part):
            return _normalize(part)
    return _normalize(parts[-1])


def _match_place(event_location: str, place_name: str, place_address: str) -> bool:
    """
    Проверяет, относится ли событие к указанному месту.
    Сравнивает название места или адрес события с названием/адресом места.
    """
    ev_norm = _normalize(event_location)
    pl_name_norm = _normalize(place_name)
    pl_addr_norm = _normalize(place_address)

    # 1. Прямое совпадение названия места с началом адреса события
    #    (например, "Барн, Каштановая аллея 1а" содержит "Барн")
    if pl_name_norm and (ev_norm.startswith(pl_name_norm) or pl_name_norm in ev_norm):
        return True

    # 2. Совпадение по адресу (улица + дом)
    ev_street = _extract_street(event_location)
    if ev_street and pl_addr_norm:
        if ev_street == _extract_street(place_address):
            return True
        # Или если адрес места содержится в адресе события
        if pl_addr_norm in ev_norm:
            return True

    return False


def _find_matching_place(event_location: str, places: List[dict]) -> Optional[dict]:
    """Ищет место из справочника, соответствующее адресу события."""
    for place in places:
        if _match_place(event_location, place.get("name", ""), place.get("address", "")):
            return place
    return None


# ─── ID события ─────────────────────────────────────

def make_event_id(date: str, title: str, location: str | None = None) -> str:
    """
    Генерирует стабильный ID на основе даты и названия.
    Адрес (location) НЕ участвует — он может меняться при геокодинге,
    а ID должен оставаться неизменным между запусками.
    """
    source = f"{date}|{title}"
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
        "extra_dates"      : parsed.get("extra_dates", []),
    }


def _attach_image(ev: dict, msg: dict) -> None:
    """Скачивает лучшее фото из сообщения и загружает в Supabase Storage."""
    import tempfile
    from .telegram_api import download_image

    photos = msg.get("photo")
    if not isinstance(photos, list) or not photos:
        return
    best = max(photos, key=lambda p: p.get("file_size", 0))
    url  = get_file_url(best["file_id"])
    if not url:
        return

    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    try:
        if download_image(url, tmp_path):
            with open(tmp_path, "rb") as f:
                image_data = f.read()
            image_url = upload_event_image(ev["id"], image_data)
            if image_url:
                ev["imageUrl"] = image_url
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def _attach_thumbnail(ev: dict, msg: dict) -> None:
    """
    Скачивает thumbnail из видео/анимации и загружает в Supabase Storage.
    Аналогично _attach_image, но для video/animation.
    """
    import tempfile
    from .telegram_api import download_image, get_thumbnail_url

    url = get_thumbnail_url(msg)
    if not url:
        return

    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    try:
        if download_image(url, tmp_path):
            with open(tmp_path, "rb") as f:
                image_data = f.read()
            image_url = upload_event_image(ev["id"], image_data)
            if image_url:
                ev["imageUrl"] = image_url
                logger.info(f"Thumbnail прикреплён к событию {ev['id']}")
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def _clone_event_for_date(ev: dict, new_date: str) -> dict:
    """Создаёт копию события с новой датой и пересчитывает ID (только по date+title)."""
    import copy
    new_ev = copy.deepcopy(ev)
    new_ev["date"] = new_date
    new_ev["id"] = make_event_id(new_date, new_ev["title"])
    # Оставляем imageUrl/image_url для всех дней (одна афиша на multiday-событие)
    return new_ev


# ─── Одиночное сообщение ────────────────────────────

def process_single_message(msg: dict, geocache: dict, places: List[dict]) -> Optional[dict]:
    text = msg.get("text") or msg.get("caption") or ""
    if not text:
        return None

    entities = msg.get("entities") or msg.get("caption_entities") or []
    logger.info(f"Обработка msg_id={msg.get('message_id')}: {text[:200]!r}")

    parsed = parse_post(text, entities)
    if not parsed:
        logger.warning(f"Не удалось распарсить пост:\n{text[:500]}")
        return None

    # Сначала проверяем places.json — если место найдено, Nominatim не нужен
    matched_place = _find_matching_place(parsed["location"], places)
    if matched_place:
        lat = matched_place["lat"]
        lon = matched_place["lng"]
        logger.info(
            f"Координаты из places.json «{matched_place['name']}»: "
            f"({lat:.6f}, {lon:.6f})"
        )
    else:
        # Геокодируем через Nominatim только если место не найдено в справочнике
        lat, lon = geocode_address(parsed["location"], geocache)
        if lat is None:
            logger.warning(f"Не удалось геокодировать: {parsed['location']!r} — пропускаем")
            return None

    ev = _build_event_dict(parsed, msg.get("message_id"), lat, lon)
    _attach_image(ev, msg)
    _attach_thumbnail(ev, msg)
    logger.info(f"Обработано: {ev['title']} ({ev['date']}) @ {parsed['address']}")
    return ev


# ─── Медиагруппа ────────────────────────────────────

def process_media_group(msgs: List[dict], geocache: dict, places: List[dict]) -> Optional[dict]:
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

    # Сначала проверяем places.json — если место найдено, Nominatim не нужен
    matched_place = _find_matching_place(parsed["location"], places)
    if matched_place:
        lat = matched_place["lat"]
        lon = matched_place["lng"]
        logger.info(
            f"Координаты из places.json «{matched_place['name']}»: "
            f"({lat:.6f}, {lon:.6f})"
        )
    else:
        # Геокодируем через Nominatim только если место не найдено в справочнике
        lat, lon = geocode_address(parsed["location"], geocache)
        if lat is None:
            logger.warning(f"Не удалось геокодировать (медиагруппа): {parsed['location']!r} — пропускаем")
            return None

    ev = _build_event_dict(parsed, text_msg.get("message_id"), lat, lon)

    # Thumbnail из видео (фоллбэк, если в группе нет фото)
    _attach_thumbnail(ev, text_msg)

    # Одна афиша для всего события (без сравнения "лучшего" фото по всем
    # сообщениям альбома) — берём первое сообщение группы, где есть фото,
    # и внутри него — самый качественный размер (это разные разрешения
    # ОДНОЙ фотографии, а не разные фото, поэтому max по file_size корректен).
    photo_msg = next((m for m in msgs if m.get("photo")), None)
    if photo_msg:
        sizes = photo_msg["photo"]
        best = max(sizes, key=lambda p: p.get("file_size", 0))
        url = get_file_url(best["file_id"])
        if url:
            import tempfile
            from .telegram_api import download_image

            tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            tmp_path = Path(tmp.name)
            tmp.close()
            try:
                if download_image(url, tmp_path):
                    with open(tmp_path, "rb") as f:
                        image_data = f.read()
                    image_url = upload_event_image(ev["id"], image_data)
                    if image_url:
                        ev["imageUrl"] = image_url
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()

    logger.info(f"Обработана медиагруппа: {ev['title']} ({ev['date']})")
    return ev


# ─── Основная обработка пачки сообщений ─────────────

def process_messages(
    messages   : List[dict],
    existing   : List[dict],
    geocache   : dict,
) -> Tuple[List[dict], int, int]:
    events_by_id: Dict[str, dict] = {e["id"]: e for e in existing if e.get("id")}

    # Загружаем справочник мест
    places = _load_places()
    logger.info(f"Загружено мест из places.json: {len(places)}")

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

    def _upsert_multi_day(ev: Optional[dict]) -> None:
        """Создаёт копии события для каждой extra_dates."""
        nonlocal added
        if not ev:
            return
        extra_dates = ev.pop("extra_dates", [])
        _upsert(ev)
        for new_date in extra_dates:
            clone = _clone_event_for_date(ev, new_date)
            _upsert(clone)

    for msg in solo:
        _upsert_multi_day(process_single_message(msg, geocache, places))

    for group_msgs in media_groups.values():
        _upsert_multi_day(process_media_group(group_msgs, geocache, places))

    logger.info(f"Обработано: добавлено {added}, обновлено {updated}")
    return list(events_by_id.values()), added, updated


# clean_old_posters удалена — заменена Edge Function cleanup-old-images на Supabase
