#!/usr/bin/env python3
"""
MeowAfisha · parse_telegram.py
Парсинг постов из Telegram-канала @meowafisha для GitHub Pages.

Что делает:
- читает новые channel_post через Bot API getUpdates (POST+JSON);
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

# Nominatim rate limiting: не чаще 1 запроса в секунду
_NOMINATIM_MIN_INTERVAL = 1.1  # seconds
_last_nominatim_call: float = 0.0


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
def _build_geocode_queries(address: str) -> List[str]:
    """
    Строит несколько вариантов запроса для Nominatim — от полного к упрощённому.

    Проблема: посты содержат адреса вида «Название заведения, Улица, Номер»
    (например, «Шум, Пионерский пляж, Портовая 1»). Nominatim не умеет
    разбирать название заведения и возвращает пустой результат.

    Стратегии (применяются по очереди до первого успеха):
      1. Полный адрес как есть
      2. Без первой части (убираем название заведения)
      3. Только последняя часть (улица + номер)
      4. Две последние части
      5. Улица + номер + город, извлечённый из средних частей
    """
    addr = address.strip().rstrip(".")
    parts = [p.strip() for p in addr.split(",") if p.strip()]

    def with_city(s: str) -> str:
        """Добавляет «Калининград» если нет городского ориентира."""
        if not re.search(KLGD_CITIES, s, re.I):
            return f"{s}, Калининград"
        return s

    seen: set = set()
    result: List[str] = []

    def add(s: str) -> None:
        q = with_city(s.strip())
        if q and q not in seen:
            seen.add(q)
            result.append(q)

    # 1. Полный адрес
    add(addr)

    if len(parts) >= 2:
        # 2. Без первой части (название заведения)
        add(", ".join(parts[1:]))
        # 3. Только улица + номер (последняя часть)
        add(parts[-1])

    if len(parts) >= 3:
        # 4. Две последние части
        add(", ".join(parts[-2:]))

    # 5. Улица + город, если город упомянут в средних частях адреса
    #    Пример: «Шум, Пионерский пляж, Портовая 1»
    #    → ищем «пионерский» в «Пионерский пляж», строим «Портовая 1, пионерский»
    for part in parts[:-1]:
        m = re.search(KLGD_CITIES, part, re.I)
        if m:
            add(f"{parts[-1]}, {m.group(1)}")
            break

    return result


def _nominatim_request(query: str) -> Optional[Tuple[float, float]]:
    """Один HTTP-запрос к Nominatim. Возвращает (lat, lon) или None."""
    global _last_nominatim_call

    # Rate limiting
    elapsed = time.monotonic() - _last_nominatim_call
    if elapsed < _NOMINATIM_MIN_INTERVAL:
        time.sleep(_NOMINATIM_MIN_INTERVAL - elapsed)
    _last_nominatim_call = time.monotonic()

    try:
        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "MeowAfishaBot/1.0 (github actions)"}
        params = {
            "q": query,
            "format": "json",
            "limit": 1,
            "countrycodes": "RU",
            "viewbox": (
                f"{KLGD_BBOX['min_lon']},{KLGD_BBOX['max_lat']},"
                f"{KLGD_BBOX['max_lon']},{KLGD_BBOX['min_lat']}"
            ),
            "bounded": 0,
        }
        resp = session.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                if is_in_klgd(lat, lon):
                    return lat, lon
                logger.debug(f"[NOMINATIM] Вне КО: {query!r} ({lat:.4f}, {lon:.4f})")
            else:
                logger.debug(f"[NOMINATIM] Нет результата: {query!r}")
        elif resp.status_code == 429:
            logger.error("[NOMINATIM] Rate limit 429 — ждём 5 секунд...")
            time.sleep(5)
        else:
            logger.warning(f"[NOMINATIM] HTTP {resp.status_code}: {query!r}")
    except Exception as e:
        logger.error(f"[NOMINATIM] Ошибка для {query!r}: {e}")

    return None


def geocode_address(address: str, cache: dict) -> Tuple[Optional[float], Optional[float]]:
    """
    Геокодирует адрес через Nominatim с rate limiting и многошаговой
    нормализацией. Пробует несколько вариантов запроса последовательно.
    """
    addr = (address or "").strip()
    if not addr:
        return None, None

    # Проверяем кэш (промахи [None, None] не сохраняются на диск,
    # так что на следующем запуске адрес будет запрошен снова)
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
        logger.debug(f"[CACHE] Промах (в этом запуске уже пробовали): {addr!r}")
        return None, None

    queries = _build_geocode_queries(addr)
    logger.debug(f"[NOMINATIM] Варианты запроса для {addr!r}: {queries}")

    for query in queries:
        result = _nominatim_request(query)
        if result:
            lat, lon = result
            cache[addr] = [lat, lon]
            logger.info(f"[NOMINATIM] OK: {addr!r}  (запрос: {query!r})  → {lat:.6f}, {lon:.6f}")
            return lat, lon

    logger.warning(f"[NOMINATIM] Все варианты не дали результата для: {addr!r}")
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

    # FIX: re.search вместо re.match — надёжнее с эмодзи/символами перед датой
    date_title_match = re.search(
        r"(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?\s*[|–—\-]\s*(.+)$",
        first_line,
    )
    if not date_title_match:
        logger.debug(f"Не удалось распарсить первую строку: {first_line!r}")
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

    # Обработка времени: сначала из первой строки, затем ищем в описании
    time_str = ""
    if hour is not None and minute is not None:
        time_str = f"{int(hour):02d}:{int(minute):02d}"
    else:
        # Ищем время в формате "в xx:xx" или просто "xx:xx" в описании
        time_match = re.search(r'в\s+(\d{1,2}):(\d{2})', text, re.IGNORECASE)
        if not time_match:
            # Ищем первое сочетание цифр xx:xx без префикса
            time_match = re.search(r'\b(\d{1,2}):(\d{2})\b', text)
        if time_match:
            h = int(time_match.group(1))
            m = int(time_match.group(2))
            if 0 <= h <= 23 and 0 <= m <= 59:
                time_str = f"{h:02d}:{m:02d}"

    addr_match = re.search(r"📍\s*(.+)", text)
    if not addr_match:
        logger.debug(f"Нет адреса (📍) в посте: {title!r}")
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

    # Попытка извлечь контакты / ссылку: http(s), tg://, t.me, telegram.me, @username
    contacts = ""
    # Ищем явные ссылки http/https и tg://
    m = re.search(r"(https?://\S+|tg://\S+)", text)
    if m:
        contacts = m.group(1).strip()
    else:
        # Ищем ссылки вида t.me/xxx или telegram.me/xxx без схемы
        m2 = re.search(r"\b(?:t\.me|telegram\.me)/([\w\d_\-]+)\b", text, re.I)
        if m2:
            contacts = f"https://t.me/{m2.group(1)}"
        else:
            # Ищем @username
            m3 = re.search(r"@([A-Za-z0-9_]{3,32})", text)
            if m3:
                contacts = "@" + m3.group(1)

    # Парсинг ключевых слов для тегов
    keywords = ["Концерт", "Вечеринка", "Фестиваль", "Выставка", "Лекция", "Спектакль", "Кинопоказ", "Йога"]
    found_tags = []
    for kw in keywords:
        if re.search(rf"\b{kw}\b", text, re.IGNORECASE):
            found_tags.append(kw)
    
    # Проверяем на бесплатный вход
    if re.search(r'\b(вход\s+свободный|вход\s+бесплатный|бесплатный\s+вход|свободный\s+вход|вход\s+free|бесплатно)\b', text, re.IGNORECASE):
        if "Бесплатно" not in found_tags:
            found_tags.append("Бесплатно")
    
    # Добавляем хэштеги, исключая системные (meow...)
    hashtags = re.findall(r"#(\w+)", text)
    for h in hashtags:
        if not h.lower().startswith("meow"):
            if not any(t.lower() == h.lower() for t in found_tags):
                found_tags.append(h)
                
    tags = found_tags

    if not title or not date_str or not address:
        logger.debug(
            f"Пропущен: нет обязательных полей "
            f"(title={title!r}, date={date_str!r}, address={address!r})"
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
    """
    Получить channel_post через Bot API.

    ВАЖНО: используем POST + JSON-тело, а не GET + query params.
    При передаче через params= библиотека requests сериализует список
    ["channel_post"] как ?allowed_updates=channel_post (строку), а не как
    JSON-массив. Telegram в таком случае игнорирует параметр и возвращает
    дефолтные типы обновлений, в которые channel_post НЕ входит.
    """
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан!")
        return []

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    payload: Dict[str, Any] = {
        "timeout": 0,
        "limit": limit,
        "allowed_updates": ["channel_post"],  # передаётся как JSON-массив
    }
    if offset:
        payload["offset"] = offset

    try:
        # FIX: POST + json= вместо GET + params=
        resp = session.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                messages = []
                for update in data.get("result", []):
                    msg = update.get("channel_post") or update.get("message") or {}
                    chat = msg.get("chat", {})
                    if chat.get("username", "").lower() == CHANNEL_USERNAME.lstrip("@").lower():
                        # FIX: не мутируем оригинальный dict из API-ответа
                        msg = {**msg, "update_id": update["update_id"]}
                        messages.append(msg)
                return messages
            logger.error(f"Telegram API error: {data}")
        else:
            logger.error(f"Telegram API HTTP {resp.status_code}: {resp.text[:200]}")
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
                return (
                    f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}"
                    f"/{data['result']['file_path']}"
                )
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
    """
    FIX: используем hashlib вместо самодельного DJB2.
    hashlib.md5 — стабильный, платформонезависимый, без переполнений.
    """
    source = f"{date}|{title}|{location}"
    return hashlib.md5(source.encode("utf-8")).hexdigest()[:12]


# ─── Storage ───────────────────────────────────────────
def load_existing_events() -> List[dict]:
    data = load_json(OUTPUT_JSON, [])
    return data if isinstance(data, list) else []


def save_events(events: List[dict]) -> None:
    events.sort(key=lambda e: e.get("date", ""))
    save_json(OUTPUT_JSON, events)
    logger.info(f"Сохранено {len(events)} событий в events.json")


# ─── Processing ─────────────────────────────────────────
def _attach_image(ev: dict, msg: dict) -> None:
    """Скачивает фото из сообщения и добавляет imageUrl в событие."""
    if "photo" not in msg or not isinstance(msg["photo"], list) or not msg["photo"]:
        return
    best_photo = max(msg["photo"], key=lambda p: p.get("file_size", 0))
    file_url = get_file_url(best_photo["file_id"])
    if file_url:
        img_path = IMAGES_DIR / f"{ev['id']}.jpg"
        if download_image(file_url, img_path):
            ev["imageUrl"] = f"images/{img_path.name}"


def process_single_message(msg: dict, geocache: dict) -> Optional[dict]:
    text = msg.get("text") or msg.get("caption") or ""
    if not text:
        return None

    logger.info(f"Обработка сообщения msg_id={msg.get('message_id')}, первые 300 символов:\n{text[:300]}")

    parsed = parse_post(text)
    if not parsed:
        logger.warning(f"Не удалось распарсить пост (первые 500 символов):\n{text[:500]}")
        return None

    lat, lon = geocode_address(parsed["location"], geocache)
    if lat is None:
        logger.warning(f"Не удалось геокодировать адрес: {parsed['location']!r} — событие пропущено")
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
    _attach_image(ev, msg)

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
        logger.warning(f"Не удалось геокодировать адрес (медиагруппа): {parsed['location']!r} — пропускаем")
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

    # Берём лучшее фото из всех сообщений группы
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


def process_messages(
    messages: List[dict],
    existing_events: List[dict],
    geocache: dict,
) -> Tuple[List[dict], int, int]:
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

    logger.info(
        f"Существующих событий: {len(existing)}, "
        f"кэш: {len(geocache)}, "
        f"last_update_id: {state.get('last_update_id', 0)}"
    )

    offset = (
        int(state.get("last_update_id", 0)) + 1
        if state.get("last_update_id", 0)
        else None
    )
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
    
    # Удаляем файлы афиш для прошедших мероприятий 
    def clean_old_posters(events_list: List[dict]) -> bool:
        changed = False
        today = datetime.now().date()
        threshold = today - timedelta(days=7)  # удаляем афиши для событий, состоявшихся не позднее недели назад
        for ev in events_list:
            d = parse_date(ev.get("date", ""))
            if not d:
                continue
            if d.date() <= threshold:
                img = ev.get("imageUrl")
                if img:
                    img_path = BASE_DIR / img
                    try:
                        if img_path.exists():
                            img_path.unlink()
                            logger.info(f"Удалена афиша: {img_path}")
                    except Exception as e:
                        logger.warning(f"Не удалось удалить {img_path}: {e}")
                    # Убираем ссылку на изображение из записи
                    ev.pop("imageUrl", None)
                    changed = True
        return changed

    cleaned = clean_old_posters(all_events)

    if added > 0 or updated > 0 or cleaned:
        save_events(all_events)
        logger.info(f"События обновлены: +{added}, ~{updated}{' (афиши очищены)' if cleaned else ''}")
    else:
        logger.info("Изменений нет")

    save_geocache(geocache)
    save_state(state)
    logger.info("Готово!")


if __name__ == "__main__":
    main()