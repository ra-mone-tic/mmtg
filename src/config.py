"""
MeowAfisha · src/config.py
Все константы и пути проекта.
"""
from __future__ import annotations

import os
from pathlib import Path

# ─── Telegram ───────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHANNEL_USERNAME   = "@meowafisha"

# ─── Пути ───────────────────────────────────────────
# Корень проекта — одна директория выше src/
BASE_DIR   = Path(__file__).parent.parent.resolve()
OUTPUT_JSON = BASE_DIR / "events.json"
CACHE_FILE  = BASE_DIR / "geocode_cache.json"
STATE_FILE  = BASE_DIR / "state.json"
IMAGES_DIR  = BASE_DIR / "images"

# ─── Калининградская область ─────────────────────────
KLGD_BBOX = {
    "min_lat": 54.0,
    "max_lat": 55.6,
    "min_lon": 19.3,
    "max_lon": 23.1,
}

KLGD_CITIES = (
    r"(калининград|гурьевск|светлогорск|янтарный|зеленоградск|"
    r"пионерский|балтийск|советск|черняховск|гусев|неман|мамоново|"
    r"правдинск|краснознаменск|озёрск|нестеров|багратионовск|славск|"
    r"полярный|посёлок|пос\.|г\.|п\.)"
)

# ─── Nominatim rate limiting ─────────────────────────
NOMINATIM_MIN_INTERVAL = 1.1   # секунд между запросами
