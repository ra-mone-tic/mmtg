#!/usr/bin/env python3
"""
MeowAfisha · parse_telegram.py
Парсинг постов из Telegram-канала @meowafisha.
Запускается через GitHub Actions по cron (раз в час).
Сохраняет результат в events.json и geocode_cache.json.
"""

import os
import sys
import json
import re
import time
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Tuple, List, Dict, Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Логирование
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# ─── Конфигурация ──────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHANNEL_USERNAME = "@meowafisha"  # Username канала

# Пути
BASE_DIR = Path(__file__).parent.resolve()
OUTPUT_JSON = BASE_DIR / "events.json"
CACHE_FILE = BASE_DIR / "geocode_cache.json"

# Калининградская область (bbox)
KLGD_BBOX = {
    "min_lat": 54.0,
    "max_lat": 55.6,
    "min_lon": 19.3,
    "max_lon": 23.1
}

# Города КО для подстановки
KLGD_CITIES = r"(калининград|гурьевск|светлогорск|янтарный|зеленоградск|пионерский|балтийск|советск|черняховск|гусев|неман|мамоново|правдинск|краснознаменск|озёрск|нестеров|багратионовск|славск|полярный|посёлок|пос\.|г\.|п\.)"

# Session с retry
def make_session() -> requests.Session:
    s = requests.Session()
    retry = Retry(total=3, backoff_factor=0.5, status_forcelist=[500,502,503,504])
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s

session = make_session()

# ─── Геокодинг (только Nominatim, только КО) ──────────
def is_in_klgd(lat: float, lon: float) -> bool:
    """Проверить, находится ли точка в Калининградской области."""
    return (KLGD_BBOX["min_lat"] <= lat <= KLGD_BBOX["max_lat"] and
            KLGD_BBOX["min_lon"] <= lon <= KLGD_BBOX["max_lon"])

def load_geocache() -> dict:
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text(encoding='utf-8'))
            if isinstance(data, dict):
                logger.info(f"Загружен кэш геокодинга: {len(data)} адресов")
                return data
        except Exception as e:
            logger.warning(f"Ошибка загрузки кэша: {e}")
    return {}

def save_geocache(cache: dict) -> None:
    try:
        # Чистим от None/невалидных записей
        clean = {k: v for k, v in cache.items() if isinstance(v, list) and len(v) == 2 and v[0] is not None}
        CACHE_FILE.write_text(json.dumps(clean, ensure_ascii=False, indent=2), encoding='utf-8')
        logger.info(f"Кэш сохранён: {len(clean)} адресов")
    except Exception as e:
        logger.error(f"Ошибка сохранения кэша: {e}")

def geocode_address(address: str, cache: dict) -> Tuple[Optional[float], Optional[float]]:
    """Геокодировать адрес через Nominatim с кэшем."""
    addr = address.strip()
    if not addr:
        return None, None

    # Проверка кэша
    if addr in cache:
        coords = cache[addr]
        if coords and len(coords) == 2 and coords[0] is not None:
            logger.info(f"[CACHE] HIT: {addr}")
            return tuple(coords)

    # Добавляем город если не указан
    query = addr
    if not re.search(KLGD_CITIES, addr, re.I):
        query = f"{addr}, Калининград"

    # Nominatim
    try:
        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "MeowAfishaBot/1.0 (telegram bot)"}
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
                    return lat, lon
                else:
                    logger.warning(f"[NOMINATIM] Вне КО: {addr} ({lat:.4f}, {lon:.4f})")
            else:
                logger.warning(f"[NOMINATIM] Нет результата: {addr}")
        else:
            logger.warning(f"[NOMINATIM] HTTP {resp.status_code}: {addr}")
    except Exception as e:
        logger.error(f"[NOMINATIM] Ошибка: {e}")

    # Не удалось — кэшируем как None
    cache[addr] = [None, None]
    return None, None

# ─── Парсинг поста ─────────────────────────────────────
def parse_post(text: str) -> Optional[dict]:
    """
    Парсит текст поста в структуру события.
    
    Формат:
    30.05 | Название
    ...
    📍Адрес
    """
    if not text or not text.strip():
        return None

    lines = [l.strip() for l in text.strip().split('\n') if l.strip()]
    if not lines:
        return None

    first_line = lines[0]

    # Извлекаем дату и название из первой строки
    # "30.05 | Название" или "30.05 20:00 | Название"
    date_title_match = re.match(r'^(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?\s*[|–—\-]\s*(.+)$', first_line)
    if not date_title_match:
        logger.debug(f"Не удалось распарсить первую строку: {first_line}")
        return None

    day = int(date_title_match.group(1))
    month = int(date_title_match.group(2))
    hour = date_title_match.group(3)
    minute = date_title_match.group(4)
    title = date_title_match.group(5).strip()

    # Определяем год (текущий, если событие в будущем, иначе следующий)
    now = datetime.now()
    current_year = now.year
    event_date = datetime(current_year, month, day)
    if event_date < now - timedelta(days=30):  # Если дата明显 в прошлом → следующий год
        current_year += 1
        event_date = datetime(current_year, month, day)

    date_str = f"{day:02d}.{month:02d}.{current_year}"

    # Время
    time_str = ""
    if hour is not None and minute is not None:
        time_str = f"{int(hour):02d}:{int(minute):02d}"

    # Ищем адрес после 📍
    address = ""
    addr_match = re.search(r'📍\s*(.+?)(?:\n|$)', text)
    if addr_match:
        address = addr_match.group(1).strip().rstrip('.')
    else:
        logger.debug(f"Нет адреса (📍) в посте: {title}")
        return None

    # Извлекаем описание (всё между первой строкой и адресом)
    desc_lines = []
    in_desc = False
    for line in lines[1:]:
        if line.startswith('📍'):
            break
        if line.startswith('➡️') or line.startswith('#'):
            continue
        desc_lines.append(line)
    
    # Убираем первую строку описания если это время
    full_description = '\n'.join(desc_lines).strip()

    # Контакты — ссылка после ➡️
    contacts = ""
    contacts_match = re.search(r'➡️\s*(?:More info|Подробнее|.+?)?\s*(https?://\S+)', text)
    if contacts_match:
        contacts = contacts_match.group(1).strip()

    # Хэштеги
    hashtags = re.findall(r'#(\w+)', text)
    tags = ', '.join(h for h in hashtags if h != 'meowafisha')

    if not title or not date_str or not address:
        logger.debug(f"Пропущен: нет обязательных полей (title={title}, date={date_str}, address={address})")
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
        "tags": tags
    }

# ─── Telegram API ──────────────────────────────────────
def get_channel_messages(offset: int = None, limit: int = 50) -> List[dict]:
    """Получить последние сообщения из канала через Bot API."""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан!")
        return []

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    params = {"timeout": 10, "limit": limit}
    if offset:
        params["offset"] = offset

    try:
        resp = session.get(url, params=params, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                # Фильтруем только сообщения из нашего канала
                messages = []
                for update in data.get("result", []):
                    msg = update.get("channel_post") or update.get("message", {})
                    chat = msg.get("chat", {})
                    # Проверяем username канала
                    if chat.get("username", "").lower() == CHANNEL_USERNAME.lstrip("@"):
                        msg["update_id"] = update["update_id"]
                        messages.append(msg)
                return messages
            else:
                logger.error(f"Telegram API error: {data}")
        else:
            logger.error(f"Telegram API HTTP {resp.status_code}")
    except Exception as e:
        logger.error(f"Telegram API request failed: {e}")

    return []

def get_file_url(file_id: str) -> Optional[str]:
    """Получить URL для скачивания файла из Telegram."""
    if not TELEGRAM_BOT_TOKEN:
        return None
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile"
    try:
        resp = session.get(url, params={"file_id": file_id}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data["result"].get("file_path"):
                return f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{data['result']['file_path']}"
    except Exception as e:
        logger.warning(f"Failed to get file URL: {e}")
    return None

def download_image(url: str, dest: Path) -> bool:
    """Скачать изображение."""
    try:
        resp = session.get(url, timeout=30)
        if resp.status_code == 200:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(resp.content)
            logger.info(f"Скачано изображение: {dest}")
            return True
    except Exception as e:
        logger.warning(f"Не удалось скачать {url}: {e}")
    return False

# ─── Генерация ID ──────────────────────────────────────
def make_event_id(date: str, title: str, location: str) -> str:
    """Генерировать стабильный ID."""
    source = f"{date}|{title}|{location}"
    h = 5381
    for c in source:
        h = ((h << 5) + h) + ord(c)
    return f"{h & 0x7FFFFFFF:08x}"

# ─── Основная логика ───────────────────────────────────
def load_existing_events() -> List[dict]:
    if OUTPUT_JSON.exists():
        try:
            return json.loads(OUTPUT_JSON.read_text(encoding='utf-8'))
        except Exception as e:
            logger.warning(f"Ошибка загрузки events.json: {e}")
    return []

def save_events(events: List[dict]) -> None:
    events.sort(key=lambda e: e.get("date", ""))
    OUTPUT_JSON.write_text(
        json.dumps(events, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    logger.info(f"Сохранено {len(events)} событий в events.json")

def process_messages(messages: List[dict], existing_events: List[dict],
                     geocache: dict) -> Tuple[List[dict], int, int]:
    """
    Обработать сообщения и вернуть обновлённый список событий.
    Возвращает: (all_events, added, updated)
    """
    # Строим индекс существующих по id
    events_by_id = {e.get("id"): e for e in existing_events}
    
    # Группируем сообщения по media_group_id
    media_groups = {}
    solo_messages = []
    
    for msg in messages:
        mgid = msg.get("media_group_id")
        if mgid:
            media_groups.setdefault(mgid, []).append(msg)
        else:
            solo_messages.append(msg)
    
    added = 0
    updated = 0
    new_events = []
    
    # Обработка одиночных сообщений
    for msg in solo_messages:
        ev = process_single_message(msg, geocache)
        if ev:
            ev_id = ev["id"]
            if ev_id in events_by_id:
                events_by_id[ev_id].update(ev)
                updated += 1
            else:
                events_by_id[ev_id] = ev
                added += 1
    
    # Обработка медиа-групп
    for group_id, group_msgs in media_groups.items():
        ev = process_media_group(group_msgs, geocache)
        if ev:
            ev_id = ev["id"]
            if ev_id in events_by_id:
                events_by_id[ev_id].update(ev)
                updated += 1
            else:
                events_by_id[ev_id] = ev
                added += 1
    
    logger.info(f"Обработано: добавлено {added}, обновлено {updated}")
    return list(events_by_id.values()), added, updated

def process_single_message(msg: dict, geocache: dict) -> Optional[dict]:
    """Обработать одно сообщение."""
    text = msg.get("text") or msg.get("caption") or ""
    if not text:
        return None
    
    parsed = parse_post(text)
    if not parsed:
        return None
    
    # Геокодинг
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
        "lon": lon
    }
    
    # Обработка фото
    if "photo" in msg:
        # Берём самое большое фото (последнее в массиве)
        photo_sizes = msg["photo"]
        best_photo = max(photo_sizes, key=lambda p: p.get("file_size", 0))
        file_url = get_file_url(best_photo["file_id"])
        if file_url:
            ev["imageUrl"] = file_url
    
    logger.info(f"Обработано: {ev['title']} ({ev['date']}) @ {parsed['address']}")
    return ev

def process_media_group(msgs: List[dict], geocache: dict) -> Optional[dict]:
    """Обработать группу медиа-сообщений (несколько фото = 1 событие)."""
    # Ищем сообщение с текстом/подписью
    text_msg = None
    photos = []
    
    for msg in msgs:
        text = msg.get("caption") or ""
        if text:
            text_msg = msg
        if "photo" in msg:
            photos.append(msg)
    
    # Если нет текста с подписью, берём первое сообщение
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
    
    # Геокодинг
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
        "lon": lon
    }
    
    # Берём самое большое фото из группы
    best_photo = None
    best_size = 0
    for pmsg in photos:
        for ps in pmsg.get("photo", []):
            if ps.get("file_size", 0) > best_size:
                best_size = ps["file_size"]
                best_photo = ps
    
    if best_photo:
        file_url = get_file_url(best_photo["file_id"])
        if file_url:
            ev["imageUrl"] = file_url
    
    logger.info(f"Обработана медиа-группа: {ev['title']} ({ev['date']})")
    return ev

# ─── Main ──────────────────────────────────────────────
def main():
    logger.info("="*50)
    logger.info("Запуск парсинга Telegram-канала")
    logger.info("="*50)
    
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан!")
        sys.exit(1)
    
    # Загружаем существующие данные
    existing = load_existing_events()
    geocache = load_geocache()
    logger.info(f"Существующих событий: {len(existing)}, кэш: {len(geocache)}")
    
    # Получаем сообщения из канала
    # За один раз получаем до 50 последних сообщений
    messages = get_channel_messages()
    if not messages:
        logger.info("Нет сообщений для обработки")
        save_geocache(geocache)
        return
    
    logger.info(f"Получено {len(messages)} сообщений из канала")
    
    # Обрабатываем
    all_events, added, updated = process_messages(messages, existing, geocache)
    
    # Сохраняем
    if added > 0 or updated > 0:
        save_events(all_events)
        logger.info(f"События обновлены: +{added}, ~{updated}")
    else:
        logger.info("Изменений нет")
    
    save_geocache(geocache)
    logger.info("Готово!")

if __name__ == "__main__":
    main()