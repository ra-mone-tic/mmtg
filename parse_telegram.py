#!/usr/bin/env python3
"""
MeowAfisha · parse_telegram.py
Парсинг постов из Telegram-канала @meowafisha для GitHub Pages.

Что делает:
- читает новые channel_post через Bot API getUpdates;
- парсит текст поста в структуру события;
- скачивает фото из Telegram в локальную папку images/;
- пишет в events.json только относительный путь к картинке;
- хранит last_update_id в state.json, чтобы не обрабатывать одно и то же повторно.

Запуск:
- локально: python parse_telegram.py
- GitHub Actions: по cron
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ─── Logging ────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ─── Config ─────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHANNEL_USERNAME = "@meowafisha"

BASE_DIR = Path(__file__).parent.resolve()
OUTPUT_JSON = BASE_DIR / "events.json"
CACHE_FILE = BASE_DIR / "geocode_cache.json"
STATE_FILE = BASE_DIR / "state.json"
IMAGES_DIR = BASE_DIR / "images"

# Kaliningrad region bbox
KLGD_BBOX = {
    "min_lat": 54.0,
    "max_lat": 55.6,
    "min_lon": 19.3,
    "max_lon": 23.1,
}

# Cities / keywords for Kaliningrad region
KLGD_CITIES = (
    r"(калининград|гурьевск|светлогорск|янтарный|зеленоградск|"
    r"пионерский|балтийск|советск|черняховск|гусев|неман|мамоново|"
    r"правдинск|краснознаменск|озёрск|нестеров|багратионовск|славск|"
    r"полярный|посёлок|пос\.|г\.|п\.)"
)

# ─── Session with retries ───────────────────────────────
def make_session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET", "POST"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


session = make_session()


# ─── Helpers ────────────────────────────────────────────
def pad(n: int) -> str:
    return str(n).zfill(2)


def fmt(d: datetime) -> str:
    return f"{pad(d.day)}.{pad(d.month)}.{d.year}"


def parse_date(date_str: str) -> Optional[datetime]:
    try:
        day, month, year = map(int, date_str.split("."))
        return datetime(year, month, day)
    except Exception:
        return None


def is_in_klgd(lat: float, lon: float) -> bool:
    return (
        KLGD_BBOX["min_lat"] <= lat <= KLGD_BBOX["max_lat"]
        and KLGD_BBOX["min_lon"] <= lon <= KLGD_BBOX["max_lon"]
    )


def load_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"Ошибка чтения {path.name}: {e}")
    return default


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ─── State / cache ──────────────────────────────────────
def load_geocache() -> dict:
    data = load_json(CACHE_FILE, {})
    if isinstance(data, dict):
        logger.info(f"Загружен кэш геокодинга: {len(data)} адресов")
        return data
    return {}


def save_geocache(cache: dict) -> None:
    clean = {
        k: v
        for k, v in cache.items()
        if isinstance(v, list) and len(v) == 2 and v[0] is not None and v[1] is not None
    }
    save_json(CACHE_FILE, clean)
    logger.info(f"Кэш сохранён: {len(clean)} адресов")


def load_state() -> dict:
    data = load_json(STATE_FILE, {"last_update_id": 0})
    if not isinstance(data, dict):
        data = {"last_update_id": 0}
    data.setdefault("last_update_id", 0)
    return data


def save_state(state: dict) -> None:
    save_json(STATE_FILE, state)


# ─── Geocoding ──────────────────────────────────────────
def geocode_address(address: str, cache: dict) -> Tuple[Optional[float], Optional[float]]:
    addr = (address or "").strip()
    if not addr:
        return None, None

    if addr in cache:
        coords = cache[addr]
        if (
            isinstance(coords, list)
            and len(coords) == 2
            and coords[0] is not None
            and coords[1] is not None
        ):
            logger.info(f"[CACHE] HIT: {addr}")
            return float(coords[0]), float(coords[1])

    query = addr
    if not re.search(KLGD_CITIES, addr, re.I):
        query = f"{addr}, Калининград"

    try:
        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "MeowAfishaBot/1.0 (github actions)"}
        params = {"q": query, "format": "json", "limit": 1, "countrycodes": "RU"}
        resp = session.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                if is_in_klgd(lat, lon):
                    cache[addr] = [lat, lon]
                    logger.info(f"[NOMINATIM] OK: {addr} -> {lat:.6f}, {lon:.6f}")
                    time.sleep(1.1)  # rate limiting: max 1 req/s
                    return lat, lon
                logger.warning(f"[NOMINATIM] Вне КО: {addr} ({lat:.4f}, {lon:.4f})")
            else:
                logger.warning(f"[NOMINATIM] Нет результата: {addr}")
        else:
            logger.warning(f"[NOMINATIM] HTTP {resp.status_code}: {addr}")
    except Exception as e:
        logger.error(f"[NOMINATIM] Ошибка: {e}")

    cache[addr] = [None, None]
    return None, None


# ─── Parsing ────────────────────────────────────────────
def parse_post(text: str) -> Optional[dict]:
    """
    Формат поста:
    30.05 | Название
    ...
    📍Адрес
    """
    if not text or not text.strip():
        return None

    lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
    if not lines:
        return None

    first_line = lines[0]
    date_title_match = re.search(
        r"(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?\s*[|–—\-]\s*(.+)$",
        first_line,
    )
    if not date_title_match:
        logger.debug(f"Не удалось распарсить первую строку: {first_line}")
        return None

    day = int(date_title_match.group(1))
    month = int(date_title_match.group(2))
    hour = date_title_match.group(3)
    minute = date_title_match.group(4)
    title = date_title_match.group(5).strip()

    now = datetime.now()
    current_year = now.year
    event_date = datetime(current_year, month, day)
    if event_date < now - timedelta(days=30):
        current_year += 1
        event_date = datetime(current_year, month, day)

    date_str = f"{day:02d}.{month:02d}.{current_year}"

    time_str = ""
    if hour is not None and minute is not None:
        time_str = f"{int(hour):02d}:{int(minute):02d}"

    addr_match = re.search(r"📍\s*(.+)", text)
    if not addr_match:
        logger.debug(f"Нет адреса (📍) в посте: {title}")
        return None
    address = addr_match.group(1).strip().rstrip(".")

    desc_lines = []
    for line in lines[1:]:
        if line.startswith("📍"):
            break
        if line.startswith("➡️") or line.startswith("#"):
            continue
        desc_lines.append(line)

    full_description = "\n".join(desc_lines).strip()

    contacts = ""
    contacts_match = re.search(r"➡️\s*(?:More info|Подробнее|.+?)?\s*(https?://\S+)", text)
    if contacts_match:
        contacts = contacts_match.group(1).strip()

    hashtags = re.findall(r"#(\w+)", text)
    tags = ", ".join(h for h in hashtags if h.lower() != "meowafisha")

    if not title or not date_str or not address:
        logger.debug(
            f"Пропущен: нет обязательных полей (title={title}, date={date_str}, address={address})"
        )
        return None

    return {
        "title": title,
        "date": date_str,
        "time": time_str,
        "location": address,
        "address": address,
        "full_description": full_description,
        "short_description": full_description[:200] if full_description else "",
        "contacts": contacts,
        "tags": tags,
    }


# ─── Telegram API ───────────────────────────────────────
def get_channel_messages(offset: int = None, limit: int = 50) -> List[dict]:
    """Получить channel_post через Bot API."""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан!")
        return []

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    payload = {
        "timeout": 0,  # для GitHub Actions polling не нужен
        "limit": limit,
        "allowed_updates": ["channel_post"],
    }
    if offset:
        payload["offset"] = offset

    try:
        resp = session.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                messages = []
                for update in data.get("result", []):
                    msg = update.get("channel_post") or update.get("message") or {}
                    chat = msg.get("chat", {})
                    if chat.get("username", "").lower() == CHANNEL_USERNAME.lstrip("@").lower():
                        msg = {**msg, "update_id": update["update_id"]}
                        messages.append(msg)
                return messages
            logger.error(f"Telegram API error: {data}")
        else:
            logger.error(f"Telegram API HTTP {resp.status_code}")
    except Exception as e:
        logger.error(f"Telegram API request failed: {e}")

    return []


def get_file_url(file_id: str) -> Optional[str]:
    if not TELEGRAM_BOT_TOKEN:
        return None

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile"
    try:
        resp = session.get(url, params={"file_id": file_id}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("result", {}).get("file_path"):
                return f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{data['result']['file_path']}"
    except Exception as e:
        logger.warning(f"Failed to get file URL: {e}")
    return None


def download_image(url: str, dest: Path) -> bool:
    try:
        resp = session.get(url, timeout=30)
        if resp.status_code == 200:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(resp.content)
            logger.info(f"Скачано изображение: {dest}")
            return True
        logger.warning(f"Не удалось скачать изображение: HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"Не удалось скачать {url}: {e}")
    return False


# ─── Event ID ───────────────────────────────────────────
def make_event_id(date: str, title: str, location: str) -> str:
    source = f"{date}|{title}|{location}"
    return hashlib.md5(source.encode()).hexdigest()[:8]


# ─── Storage ───────────────────────────────────────────
def load_existing_events() -> List[dict]:
    data = load_json(OUTPUT_JSON, [])
    return data if isinstance(data, list) else []


def save_events(events: List[dict]) -> None:
    events.sort(key=lambda e: e.get("date", ""))
    save_json(OUTPUT_JSON, events)
    logger.info(f"Сохранено {len(events)} событий в events.json")


# ─── Processing ─────────────────────────────────────────
def process_single_message(msg: dict, geocache: dict) -> Optional[dict]:
    text = msg.get("text") or msg.get("caption") or ""
    if not text:
        return None

    logger.info(f"Обработка сообщения, первые 300 символов:\n{text[:300]}")
    logger.info(f"msg keys: {list(msg.keys())}")

    parsed = parse_post(text)
    if not parsed:
        logger.warning(f"Не удалось распарсить пост (первые 500 символов):\n{text[:500]}")
        return None

    lat, lon = geocode_address(parsed["location"], geocache)
    if lat is None:
        logger.warning(f"Не удалось геокодировать: {parsed['location']}, пропускаем")
        return None

    ev = {
        "id": make_event_id(parsed["date"], parsed["title"], parsed["location"]),
        "date": parsed["date"],
        "title": parsed["title"],
        "location": parsed["address"],
        "address": parsed["address"],
        "time": parsed["time"],
        "tags": parsed["tags"],
        "short_description": parsed["short_description"],
        "full_description": parsed["full_description"],
        "contacts": parsed["contacts"],
        "lat": lat,
        "lon": lon,
    }

    if "photo" in msg and isinstance(msg["photo"], list) and msg["photo"]:
        best_photo = max(msg["photo"], key=lambda p: p.get("file_size", 0))
        file_url = get_file_url(best_photo["file_id"])
        if file_url:
            img_path = IMAGES_DIR / f"{ev['id']}.jpg"
            if download_image(file_url, img_path):
                ev["imageUrl"] = f"images/{img_path.name}"

    logger.info(f"Обработано: {ev['title']} ({ev['date']}) @ {parsed['address']}")
    return ev


def process_media_group(msgs: List[dict], geocache: dict) -> Optional[dict]:
    text_msg = None
    photos: List[dict] = []

    for msg in msgs:
        caption = msg.get("caption") or ""
        if caption:
            text_msg = msg
        if "photo" in msg:
            photos.append(msg)

    if not text_msg and msgs:
        text_msg = msgs[0]

    if not text_msg:
        return None

    text = text_msg.get("caption") or text_msg.get("text") or ""
    if not text:
        return None

    parsed = parse_post(text)
    if not parsed:
        return None

    lat, lon = geocode_address(parsed["location"], geocache)
    if lat is None:
        return None

    ev = {
        "id": make_event_id(parsed["date"], parsed["title"], parsed["location"]),
        "date": parsed["date"],
        "title": parsed["title"],
        "location": parsed["address"],
        "address": parsed["address"],
        "time": parsed["time"],
        "tags": parsed["tags"],
        "short_description": parsed["short_description"],
        "full_description": parsed["full_description"],
        "contacts": parsed["contacts"],
        "lat": lat,
        "lon": lon,
    }

    best_photo = None
    best_size = 0
    for pmsg in photos:
        for ps in pmsg.get("photo", []):
            size = ps.get("file_size", 0)
            if size > best_size:
                best_size = size
                best_photo = ps

    if best_photo:
        file_url = get_file_url(best_photo["file_id"])
        if file_url:
            img_path = IMAGES_DIR / f"{ev['id']}.jpg"
            if download_image(file_url, img_path):
                ev["imageUrl"] = f"images/{img_path.name}"

    logger.info(f"Обработана медиа-группа: {ev['title']} ({ev['date']})")
    return ev


def process_messages(messages: List[dict], existing_events: List[dict], geocache: dict) -> Tuple[List[dict], int, int]:
    events_by_id = {e.get("id"): e for e in existing_events if e.get("id")}

    media_groups: Dict[str, List[dict]] = {}
    solo_messages: List[dict] = []

    for msg in messages:
        mgid = msg.get("media_group_id")
        if mgid:
            media_groups.setdefault(mgid, []).append(msg)
        else:
            solo_messages.append(msg)

    added = 0
    updated = 0

    for msg in solo_messages:
        ev = process_single_message(msg, geocache)
        if ev:
            ev_id = ev["id"]
            if ev_id in events_by_id:
                # сохраняем уже скачанную картинку, если новая не пришла
                old_image = events_by_id[ev_id].get("imageUrl")
                events_by_id[ev_id].update(ev)
                if old_image and not events_by_id[ev_id].get("imageUrl"):
                    events_by_id[ev_id]["imageUrl"] = old_image
                updated += 1
            else:
                events_by_id[ev_id] = ev
                added += 1

    for group_id, group_msgs in media_groups.items():
        ev = process_media_group(group_msgs, geocache)
        if ev:
            ev_id = ev["id"]
            if ev_id in events_by_id:
                old_image = events_by_id[ev_id].get("imageUrl")
                events_by_id[ev_id].update(ev)
                if old_image and not events_by_id[ev_id].get("imageUrl"):
                    events_by_id[ev_id]["imageUrl"] = old_image
                updated += 1
            else:
                events_by_id[ev_id] = ev
                added += 1

    logger.info(f"Обработано: добавлено {added}, обновлено {updated}")
    return list(events_by_id.values()), added, updated


# ─── Main ───────────────────────────────────────────────
def main() -> None:
    logger.info("=" * 50)
    logger.info("Запуск парсинга Telegram-канала")
    logger.info("=" * 50)

    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан!")
        sys.exit(1)

    existing = load_existing_events()
    geocache = load_geocache()
    state = load_state()

    logger.info(f"Существующих событий: {len(existing)}, кэш: {len(geocache)}, last_update_id: {state.get('last_update_id', 0)}")

    offset = int(state.get("last_update_id", 0)) + 1 if state.get("last_update_id", 0) else None
    messages = get_channel_messages(offset=offset)

    if not messages:
        logger.info("Нет сообщений для обработки")
        save_geocache(geocache)
        save_state(state)
        return

    logger.info(f"Получено {len(messages)} сообщений из канала")

    max_update_id = max(m.get("update_id", 0) for m in messages)
    if max_update_id:
        state["last_update_id"] = max_update_id

    all_events, added, updated = process_messages(messages, existing, geocache)

    if added > 0 or updated > 0:
        save_events(all_events)
        logger.info(f"События обновлены: +{added}, ~{updated}")
    else:
        logger.info("Изменений нет")

    save_geocache(geocache)
    save_state(state)
    logger.info("Готово!")


if __name__ == "__main__":
    main()