"""
MeowAfisha · src/utils.py
Вспомогательные функции и общий HTTP-сеанс с retry.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .config import KLGD_BBOX


# ─── HTTP-сеанс с автоповтором ───────────────────────

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
    s.mount("http://",  adapter)
    return s


# Единственный сеанс для всего приложения
session = make_session()


# ─── Форматирование дат ──────────────────────────────

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


# ─── Геопроверка ─────────────────────────────────────

def is_in_klgd(lat: float, lon: float) -> bool:
    return (
        KLGD_BBOX["min_lat"] <= lat <= KLGD_BBOX["max_lat"]
        and KLGD_BBOX["min_lon"] <= lon <= KLGD_BBOX["max_lon"]
    )
