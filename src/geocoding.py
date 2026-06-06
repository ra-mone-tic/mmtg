"""
MeowAfisha · src/geocoding.py
Геокодирование адресов через Nominatim с rate-limiting и fallback-стратегией.
"""
from __future__ import annotations

import logging
import re
import time
from typing import List, Optional, Tuple

from .config import KLGD_BBOX, KLGD_CITIES, NOMINATIM_MIN_INTERVAL
from .utils  import session, is_in_klgd

logger = logging.getLogger(__name__)

_last_nominatim_call: float = 0.0


# ─── Построение вариантов запроса ───────────────────

def _build_geocode_queries(address: str) -> List[str]:
    """
    Строит несколько вариантов запроса (от полного к упрощённому),
    потому что Nominatim плохо работает с названиями заведений в адресе.
    """
    addr  = address.strip().rstrip(".")
    parts = [p.strip() for p in addr.split(",") if p.strip()]

    def with_city(s: str) -> str:
        if not re.search(KLGD_CITIES, s, re.I):
            return f"{s}, Калининград"
        return s

    seen: set   = set()
    result: List[str] = []

    def add(s: str) -> None:
        q = with_city(s.strip())
        if q and q not in seen:
            seen.add(q)
            result.append(q)

    add(addr)                                   # 1. Полный адрес

    if len(parts) >= 2:
        add(", ".join(parts[1:]))               # 2. Без первой части (названия заведения)
        add(parts[-1])                          # 3. Только улица + номер

    if len(parts) >= 3:
        add(", ".join(parts[-2:]))              # 4. Две последние части

    # 5. Улица + найденный город из средних частей
    for part in parts[:-1]:
        m = re.search(KLGD_CITIES, part, re.I)
        if m:
            add(f"{parts[-1]}, {m.group(1)}")
            break

    return result


# ─── Один HTTP-запрос к Nominatim ───────────────────

def _nominatim_request(query: str) -> Optional[Tuple[float, float]]:
    global _last_nominatim_call

    elapsed = time.monotonic() - _last_nominatim_call
    if elapsed < NOMINATIM_MIN_INTERVAL:
        time.sleep(NOMINATIM_MIN_INTERVAL - elapsed)
    _last_nominatim_call = time.monotonic()

    try:
        resp = session.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q"           : query,
                "format"      : "json",
                "limit"       : 1,
                "countrycodes": "RU",
                "viewbox"     : (
                    f"{KLGD_BBOX['min_lon']},{KLGD_BBOX['max_lat']},"
                    f"{KLGD_BBOX['max_lon']},{KLGD_BBOX['min_lat']}"
                ),
                "bounded": 0,
            },
            headers={"User-Agent": "MeowAfishaBot/1.0 (github actions)"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data:
                lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
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


# ─── Публичная функция ───────────────────────────────

def geocode_address(
    address: str, cache: dict
) -> Tuple[Optional[float], Optional[float]]:
    """
    Возвращает (lat, lon) или (None, None).
    Промахи ([None, None]) записываются в кэш только на время сеанса —
    не сохраняются на диск, чтобы повторить попытку при следующем запуске.
    """
    addr = (address or "").strip()
    if not addr:
        return None, None

    if addr in cache:
        coords = cache[addr]
        if isinstance(coords, list) and len(coords) == 2 and None not in coords:
            logger.info(f"[CACHE] HIT: {addr}")
            return float(coords[0]), float(coords[1])
        logger.debug(f"[CACHE] Промах (уже пробовали): {addr!r}")
        return None, None

    for query in _build_geocode_queries(addr):
        result = _nominatim_request(query)
        if result:
            lat, lon = result
            cache[addr] = [lat, lon]
            logger.info(f"[NOMINATIM] OK: {addr!r}  ({query!r})  → {lat:.6f}, {lon:.6f}")
            return lat, lon

    logger.warning(f"[NOMINATIM] Все варианты не дали результата: {addr!r}")
    cache[addr] = [None, None]
    return None, None
